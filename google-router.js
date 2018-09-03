const express = require('express');
const router = express.Router();
const { spawn } = require('child_process');
const fs = require('fs');
const client = (() => {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    try {
      const textToSpeech = require('@google-cloud/text-to-speech');
      const ret = new textToSpeech.TextToSpeechClient();
      console.log('google text-to-speech initialized.');
      return ret;
    } catch(err) {
      console.error(err);
    }
  }
  console.log('google text-to-speech is disabled.');
  return null;
})();

router.post('/text-to-speech', (req, res) => {
  let text = 'こんにちは';

  let voice = {};
  let audioConfig = {};

  if ('languageCode' in req.body) {
    voice.languageCode = req.body.languageCode;
  } else {
    voice.languageCode = 'ja-JP';
  }

  if ('ssmlGender' in req.body) {
    voice.ssmlGender = req.body.ssmlGender;
  } else {
    voice.ssmlGender = 'NEUTRAL';
  }

  if ('audioEncoding' in req.body) {
    audioConfig.audioEncoding = req.body.audioEncoding;
  } else {
    audioConfig.audioEncoding = 'LINEAR16';
  }

  if ('speakingRate' in req.body) {
    audioConfig.speakingRate = req.body.speakingRate;
  }

  if ('pitch' in req.body) {
    audioConfig.pitch = req.body.pitch;
  }

  if ('name' in req.body) {
    voice.name = req.body.name;
  }

  if ('text' in req.body) {
    text = req.body.text;
  }

  // Construct the request
  const request = {
    input: { text },
    // Select the language and SSML Voice Gender (optional)
    voice,
    // Select the type of audio encoding
    audioConfig,
  };

  if (!client) {
    console.error('ERROR:', 'TextToSpeechClient is disabled.');
    res.send('NG');
    return;
  }
  
  // Performs the Text-to-Speech request
  client.synthesizeSpeech(request, (err, response) => {
    if (err) {
      console.error('ERROR:', err);
      res.send('NG');
      return;
    }

    const mp3filepath = `/tmp/output.${(audioConfig.audioEncoding==='LINEAR16')?'wav':'mp3'}`;
  
    // Write the binary audio content to a local file
    fs.writeFile(mp3filepath, response.audioContent, 'binary', err => {
      if (err) {
        console.error('ERROR:', err);
        res.send('NG');
        return;
      }
      const cmd = (process.platform === 'darwin') ? 'afplay' : 'aplay';
      const opt = (process.platform === 'darwin') ? [mp3filepath] : ['-Dplug:softvol', mp3filepath];
      console.log(`/usr/bin/${cmd} ${mp3filepath}`);
      playone = spawn(`/usr/bin/${cmd}`, opt);
      playone.on('close', function(code) {
        console.log('close', code);
        res.send('OK');
      });
    });
  });
})

module.exports = router;
