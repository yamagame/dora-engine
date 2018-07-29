# ラズパイSDカードの初回ブート時の自動リサイズを有効にする方法

作成した縮小イメージを、初回ブート時に自動的に拡張する設定方法です。

テストしたイメージは 2018-06-27-raspbian-stretch.zip で作成しました。

[https://www.raspberrypi.org/downloads/raspbian/](https://www.raspberrypi.org/downloads/raspbian/)

## 設定方法

以下の設定はリブートせずに一回で全て設定します。

### /etc/init.d/resize2fs_once を下記の内容で配置

```bash
#!/bin/sh
### BEGIN INIT INFO
# Provides:          resize2fs_once
# Required-Start:
# Required-Stop:
# Default-Start: 3
# Default-Stop:
# Short-Description: Resize the root filesystem to fill partition
# Description:
### END INIT INFO
. /lib/lsb/init-functions
case "$1" in
  start)
    log_daemon_msg "Starting resize2fs_once"
    ROOT_DEV=$(findmnt / -o source -n) &&
    resize2fs $ROOT_DEV &&
    update-rc.d resize2fs_once remove &&
    rm /etc/init.d/resize2fs_once &&
    log_end_msg $?
    ;;
  *)
    echo "Usage: \$0 start" >&2
    exit 3
    ;;
esac
```

以下のコマンドを実行して resize2fs_once を有効にする。

```
$ sudo chown root:root /etc/init.d/resize2fs_once
$ sudo chmod +x /etc/init.d/resize2fs_once
$ sudo systemctl enable resize2fs_once
```

`resize2fs_onceは一度実行されると削除されます。`

### /boot/cmdline.txt に以下の文を追加

```
init=/usr/lib/raspi-config/init_resize.sh
```

以下の様な感じになります。

```
dwc_otg.lpm_enable=0 console=serial0,115200 console=tty1 root=PARTUUID=9642926e-02 rootfstype=ext4 elevator=deadline fsck.repair=yes rootwait quiet init=/usr/lib/raspi-config/init_resize.sh splash plymouth.ignore-serial-consoles
```

`追記した項目はブート時にcmdline.txtから自動的に削除されます。`

`また、init_resize.shを1度でも実行すると、２回目は失敗するようです。`
