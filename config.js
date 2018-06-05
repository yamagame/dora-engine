const port = 3090;
const gpio_port = 3091;

module.exports = {
  port: port,
  gpio_port: gpio_port,
  server_port: 3092,
  udp: {
    host: 'localhost',
    port: port,
  },
  docomo: {
    api_key: process.env.DOCOMO_API_KEY || '',
    app_id:  process.env.DOCOMO_APP_ID  || '',
  },
  voice_hat: true,
  usb_mic:   false,
  free_editor: true,
  home: process.env.HOME,
  use_db: (process.env.ROBOT_DB==='true'),
}
