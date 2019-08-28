const path = require('path');
const port = 3090;
const gpioPort = 3091;
const bcrypt = (() => {
  try { return require('bcrypt'); }
  catch(e) { return require('bcryptjs'); }
})();

const config = {
  port: port,
  gpioPort: gpioPort,
  serverPort: 3092,
  usePowerOffButton: (process.env.ROBOT_USB_POWER_OFF_BUTTON || 'true') === 'true',
  useGamePad: (process.env.ROBOT_USB_GAMEPAD || 'false') === 'true',
  udp: {
    host: 'localhost',
    port: port,
  },
  docomo: {
    api_key: process.env.DOCOMO_API_KEY || '',
    app_id:  process.env.DOCOMO_APP_ID  || '',
  },
  robotUserDefaultsPath: process.env.ROBOT_USER_DEFAULTS_PATH || path.join(__dirname, 'robot-defaults.json'),
  commandDirPath: process.env.ROBOT_COMMAND_DIR_PATH || path.join(__dirname, 'command'),
  voiceHat: (process.env.ROBOT_USB_VOICE_HAT || 'true') === 'true',
  usbUSBMIC: (process.env.ROBOT_USB_MIC_DEVICE || 'false') !== 'false',
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
  defaultVoice: process.env.ROBOT_DEFAULT_VOICE || 'default',
  adminAuth: [
    //管理者用
    {
      username: 'admin',
      //default: robotnopass
      password: process.env.ROBOT_ADMIN_PASS || '$2b$08$4r.XgxukN5Bo/BrlDW6aYObEJgSC4o5NXOkTlGO71xQAumhHJJN72',
      permissions: '*',
    },
    //クイズ参加者用
    {
      username: 'player',
      //default: playernopass
      password: process.env.ROBOT_PLAYER_PASS || '$2b$08$7ZZ1ndbn.GG5p/WBk9WsMOZPy4pLf75vvJYbHOFkHDwWXGIqjVvfm',
      permissions: ['result.read', 'command.write',],
      guest: true,
    },
    //動画/画像サーバー用
    {
      username: 'guest-client',
      //default: guestclientnopass
      password: process.env.ROBOT_GUEST_PASS || '$2b$08$yxLRwXjWVkJStJNNAlz5pe43xG7aLcExyViyzstVPMMVBdUe4blyi',
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
    username: process.env.ROBOT_DEFAULT_USER || 'dora-engine',
    //開始したいスクリプト
    filename: process.env.ROBOT_START_SCRIPT || 'start.dora',
  },
  //Google text-to-speech関連
  synthesizeSpeech: {
    //Google認証ファイルへのパス
    credentialPath: process.env.GOOGLE_APPLICATION_CREDENTIALS || null,
    //AWS認証ファイルへのパス
    awsCredentialPath: process.env.ROBOT_AWS_CREDENTIALS || null,
    //キャッシュする音声データを保存するディレクトリ
    tempdir: process.env.ROBOT_GOOGLE_SPEECH_DATA_DIR || '/tmp',
    //キャッシュする音声データのトータルサイズ(MByte)
    maxCacheSize: process.env.ROBOT_GOOGLE_SPEECH_CACHE_SIZE || 300,
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
  //Google translate API関連
  googleTranslate: {
    //Google認証ファイルへのパス
    credentialPath: process.env.GOOGLE_APPLICATION_CREDENTIALS || null,
    //TranslateAPI ProjectId
    projectId: process.env.ROBOT_GOOGLE_TRANSLATE_PROJECT_ID || null,
    //TranslateAPI Location
    location: process.env.ROBOT_GOOGLE_TRANSLATE_LOCATION || 'global',
  },
  //対話関連
  doraChat: {
    dataDir: process.env.ROBOT_DORA_CHAT_DATA_DIR || path.join(__dirname, 'chatData'),
    weather: (process.env.ROBOT_DORA_CHAT_WEATHER || 'false') === 'true',
    wikipedia: (process.env.ROBOT_DORA_CHAT_WIKIPEDIA || 'true') === 'true',
  },
}

module.exports = config;

if (require.main === module) {
  //bcrypt を使ってパスワードのハッシュを作って adminAuth の password に設定する
  // console.log(bcrypt.hashSync('robotnopass', 8));
  // console.log(bcrypt.hashSync('playernopass', 8));
  // console.log(bcrypt.hashSync('guestclientnopass', 8));
  if (process.argv.length > 2 && process.argv[2]) {
    console.log(bcrypt.hashSync(process.argv[2], 8));
  }
}
