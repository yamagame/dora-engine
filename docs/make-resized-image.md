# リサイズされたOSイメージを作る方法

Raspberry Piの縮小されたOSイメージをRaspberry Piで作成する方法です。

十分な空き容量(作成するイメージのサイズ)のあるRaspbianで作業します。

### コマンドをインストールする

dcfldd と gparted をインストールします。

```bash
$ sudo apt-get install dcfldd gparted
```

### メモリカードリーダーを接続

縮小したいOSイメージが書き込まれた microSDカードを、カードリーダーで Raspberry Pi に接続します。

### fdiskで確認

以下のコマンドでカードリーダーのデバイスを調べます。
以下の例では、sda1 と sda2 が microSD カードのデバイスです。

```bash
$ sudo fdisk -l
:
:
:
Device     Boot Start      End  Sectors  Size Id Type
/dev/sda1        8192    96663    88472 43.2M  c W95 FAT32 (LBA)
/dev/sda2       98304 30930943 30832640 14.7G 83 Linux
```

小さくしたいのは、/dev/sda2です。

### デバイスをアンマウントする。

マウントされいたらアンマウントします。

```bash
$ sudo umount /dev/sda1
$ sudo umount /dev/sda2
```

### ディスクチェックを行う

以下のコマンドでディスクチェックを行います。

```bash
$ sudo e2fsck -f /dev/sda2
```

resize2fsコマンドを使用するには、e2fsckコマンドを実行する必要があります。

### 縮小リサイズする

以下のコマンドで縮小します。

```bash
$ sudo resize2fs -M -p /dev/sda2
```

実行が終わると以下のようなメッセージが表示されます。

```bash
resize2fs 1.43.4 (31-Jan-2017)
Resizing the filesystem on /dev/sda2 to 1464086 (4k) blocks.
Begin pass 2 (max = 179159)
Relocating blocks             XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
Begin pass 3 (max = 118)
Scanning inode table          XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
Begin pass 4 (max = 18895)
Updating inode references     XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
The filesystem on /dev/sda2 is now 1464086 (4k) blocks long.
```

「1ブロック4096バイトで、1464086ブロックのサイズになった」とあります。

### パーテーションをリサイズする

念のため、以下のコマンドでパーテーションをアンマウントします。

```bash
$ sudo umount /dev/sda2
```

下記、ページを参考にして、sda2パーテーションを小さくします。

[https://arakan60.mydns.jp/04kousaku/03-05sdcopyshrunk.html](https://arakan60.mydns.jp/04kousaku/03-05sdcopyshrunk.html)

エラーになる場合は、サイズが小さくなりすぎている場合があります。

### fdiskでディスクの状態を見る

以下の例では、sda2の終わりが11976703セクタです。
1セクタは512バイトですから、ディスクの先頭から11976703*512バイトが使用されていることになります。

```bash
$ sudo fdisk -l /dev/sda
Disk /dev/sda: 14.8 GiB, 15836643328 bytes, 30930944 sectors
Units: sectors of 1 * 512 = 512 bytes
Sector size (logical/physical): 512 bytes / 512 bytes
I/O size (minimum/optimal): 512 bytes / 512 bytes
Disklabel type: dos
Disk identifier: 0x0a65c258

Device     Boot Start      End  Sectors  Size Id Type
/dev/sda1        8192    96663    88472 43.2M  c W95 FAT32 (LBA)
/dev/sda2       98304 11976703 11878400  5.7G 83 Linux
```

### ブロックサイズを計算する

作成したいイメージは11976703*512バイトです。
読み書きするブロックサイズを32Kbyteとすると、(11976703*512)/(32*1024)+1=187136ブロックのイメージを作成します。

以下のコマンドでブロックは計算できます。

```bash
$ echo $(((11976703*512)/(32*1024)+1))
187136
```

+1を加えているのは、割り算が切り捨てだからです。

### ディスクイメージを作成

以下のコマンドでイメージを作成します。

念のため、計算したブロック数でイメージを作成します。

```bash
$ sudo dcfldd if=/dev/sda of=~/Documents/cardbot-os.img count=187136 bs=32k
```

ifで読み込み元を、ofで書き出し先を指定します。
countは読み書きするブロック数です。bsは1ブロックのブロックサイズです。
