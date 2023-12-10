# リサイズされた OS イメージを作る方法

Raspberry Pi の縮小された OS イメージを Raspberry Pi で作成する方法です。

十分な空き容量(作成するイメージのサイズ)のある Raspbian で作業します。

### メモリカードリーダーを接続

縮小したい OS イメージが書き込まれた microSD カードを、カードリーダーで Raspberry Pi に接続します。

### fdisk で確認

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

小さくしたいのは、/dev/sda2 です。

### デバイスをアンマウントする。

マウントされていたらアンマウントします。

```bash
$ sudo umount /dev/sda1
$ sudo umount /dev/sda2
```

### ディスクチェックを行う

以下のコマンドでディスクチェックを行います。

```bash
$ sudo e2fsck -f /dev/sda2
```

resize2fs コマンドを使用するには、e2fsck コマンドを実行する必要があります。

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

「1 ブロック 4096 バイトで、1464086 ブロックのサイズになった」とあります。

### パーテーションをリサイズする

念のため、以下のコマンドでパーテーションをアンマウントします。

```bash
$ sudo umount /dev/sda2
```

parted を使ってリサイズします。

※下記はパーテーションの拡張の例ですが縮小に関しても、sda2 の最終セクタを指定してリサイズする方法は同様です。

```bash
$ sudo parted
GNU Parted 3.2
Using /dev/sda
Welcome to GNU Parted! Type 'help' to view a list of commands.
```

正確なセクタ指定をするためにユニットを詳細表示に変更します。

```bash
(parted) unit s
```

セクタを確認します。

```bash
(parted) print free
Model: Generic- SD/MMC (scsi)
Disk /dev/sda: 31116288s
Sector size (logical/physical): 512B/512B
Partition Table: msdos
Disk Flags:

Number  Start     End        Size       Type     File system  Flags
        32s       8191s      8160s               Free Space
 1      8192s     532479s    524288s    primary  fat32        lba
 2      532480s   6000000s   5467521s   primary  ext4
        6000001s  31116287s  25116287s           Free Space
```

2 番のパーテーションを拡げます。一度パーテーションを削除してから作り直します。
開始セクタと最終セクタを間違えないように入力します。ここでは開始セクタは 532480s で、最終セクタは 31116287s を指定しています。

```bash
(parted) rm 2
(parted) mkpart
Partition type?  primary/extended? primary
File system type?  [ext2]? ext4
Start? 532480s
End? 31116287s
```

サイズを確認します。

```bash
(parted) print free
Model: Generic- SD/MMC (scsi)
Disk /dev/sda: 31116288s
Sector size (logical/physical): 512B/512B
Partition Table: msdos
Disk Flags:

Number  Start    End        Size       Type     File system  Flags
        32s      8191s      8160s               Free Space
 1      8192s    532479s    524288s    primary  fat32        lba
 2      532480s  31116287s  30583808s  primary  ext4         lba

```

parted を終了します。

```bash
(parted) q
Information: You may need to update /etc/fstab.
```

### fdisk でディスクの状態を見る

以下の例では、sda2 の終わりが 11976703 セクタです。
1 セクタは 512 バイトですから、ディスクの先頭から 11976703\*512 バイトが使用されていることになります。

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

作成したいイメージは 11976703*512 バイトです。
読み書きするブロックサイズを 32Kbyte とすると、(11976703*512)/(32\*1024)+1=187136 ブロックのイメージを作成します。

以下のコマンドでブロックは計算できます。

```bash
$ echo $((( 11976703 *512)/(32*1024)+1))
187136
```

+1 を加えているのは、割り算が切り捨てだからです。

### ディスクイメージを作成

以下のコマンドでイメージを作成します。

念のため、計算したブロック数でイメージを作成します。

```bash
$ sudo dd if=/dev/sda of=~/Documents/cardbot-os.img count=187136 bs=32k status=progress
```

if で読み込み元を、of で書き出し先を指定します。
count は読み書きするブロック数です。bs は 1 ブロックのブロックサイズです。

### ディスクイメージを microSD カードに書き込む

フォーマットされた microSD カードを、カードリーダーで Raspberry Pi に接続します。

microSD カードのドライブを以下のコマンドで調べます。

```bash
$ sudo fdisk -l
```

以下のコマンドでイメージを書き込みます。

```bash
$ sudo dd if=~/Documents/cardbot-os.img of=/dev/sda bs=4M status=progress
```

if で読み込み元を、of で書き出し先を指定します。

### ディスクイメージのマウント

以下のコマンドでディスクイメージを調べます。

```bash
$ fdisk -l ~/Documents/cardbot-os.img
```

start-block と block-size を掛け合わせたものを offset で指定してマウントします。
マウント先のディレクトリはあらかじめ作成しておきます。

```bash
$ sudo mount -o loop,offset=`expr 98304 '*' 512` cardbot-os.img /mnt
```
