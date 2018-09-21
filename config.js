const port = 3090;
const gpioPort = 3091;
const bcrypt = (() => {
  try { return require('bcrypt'); }
  catch(e) { return equire('bcryptjs'); }
})();

const config = {
  port: port,
  gpioPort: gpioPort,
  serverPort: 3092,
  udp: {
    host: 'localhost',
    port: port,
  },
  docomo: {
    api_key: process.env.DOCOMO_API_KEY || '',
    app_id:  process.env.DOCOMO_APP_ID  || '',
  },
  voiceHat: (process.env.ROBOT_USB_VOICE_HAT || 'true') === 'true',
  usbUSBMIC: process.env.ROBOT_USB_MIC_DEVICE || false,
  usbUSBMICDevice: process.env.ROBOT_USB_MIC_DEVICE || 'plughw:1,0',
  editorAccessControl: (process.env.ROBOT_EDITORL_ACCESS_CONTROL || 'true') === 'true',
  home: process.env.HOME,
  useDB: (process.env.ROBOT_DB==='true'),
  sessionSecret: process.env.ROBOT_SECRET_KEY || 'robot-session-cat',
  robotSecretKey: process.env.ROBOT_SECRET_KEY || 'robot-session-cat',
  robotPrivateKey: process.env.ROBOT_PRIVATE_KEY || null,
  robotPublicKey: process.env.ROBOT_PUBLIC_KEY || null,
  //認証処理を有効化
  credentialAccessControl: (process.env.ROBOT_CREDENTIAL_ACCESS_CONTROL || 'false') === 'true',
  //localhostアクセスを有効化
  allowLocalhostAccess: (process.env.ROBOT_ALLOW_LOCALHOST_ACCESS || 'true') === 'true',
  localhostIPs: [ '::1', '::ffff:127.0.0.1', ],
  adminAuth: [
    //管理者用
    {
      username: 'admin',
      //default: robotnopass
      password: '$2b$08$4r.XgxukN5Bo/BrlDW6aYObEJgSC4o5NXOkTlGO71xQAumhHJJN72',
      permissions: '*',
    },
    //クイズ参加者用
    {
      username: 'player',
      //default: playernopass
      password: '$2b$08$7ZZ1ndbn.GG5p/WBk9WsMOZPy4pLf75vvJYbHOFkHDwWXGIqjVvfm',
      permissions: ['result.read', 'command.write',],
      guest: true,
    },
    //動画/画像サーバー用
    {
      username: 'guest-client',
      //default: guestclientnopass
      password: '$2b$08$yxLRwXjWVkJStJNNAlz5pe43xG7aLcExyViyzstVPMMVBdUe4blyi',
      permissions: ['image-server.read'],
      guest: true,
    },
  ],
  localhostPermissions: '*',
  defualtUserPermissions: '*',
  startScript: {
    //自動起動させる場合はここをtrueにする
    auto: false,
    //ユーザー名
    username: 'raspberrypi',
    //開始したいスクリプト
    filename: '最初のファイル.txt',
  },
  //Google text-to-speech関連
  synthesizeSpeech: {
    //認証ファイルへのパス
    credentialPath: process.env.GOOGLE_APPLICATION_CREDENTIALS || null,
    //キャッシュする音声データを保存するディレクトリ
    tempdir: process.env.ROBOT_GOOGLE_SPEECH_DATA_DIR || '/tmp',
    //キャッシュする音声データのトータルサイズ(MByte)
    maxCacheSize: 3,
    //キャッシュファイルのDBファイル
    cacheDBPath: process.env.ROBOT_GOOGLE_SPEECH_CACHE_DB_PATH || '/tmp/robot-cacheDB.json',
  },
  //Google sheet API関連
  googleSheet: {
    //認証ファイルへのパス
    credentialPath: process.env.ROBOT_GOOGLE_SHEET_CREDENTIAL_PATH || null,
    //トークンファイルへのパス
    tokenPath: process.env.ROBOT_GOOGLE_SHEET_TOKEN_PATH || null,
  },
}

module.exports = config;

if (require.main === module) {
  //bcryptを使ってパスワードのハッシュを作ってadminAuto.passwordに設定する
  console.log(bcrypt.hashSync('robotnopass', 8));
  console.log(bcrypt.hashSync('playernopass', 8));
  console.log(bcrypt.hashSync('guestclientnopass', 8));
}
