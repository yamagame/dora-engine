const express = require('express');
const router = express.Router();
const { spawn } = require('child_process');
const textToSpeech = require('@google-cloud/text-to-speech');
const fs = require('fs');
const client = new textToSpeech.TextToSpeechClient();

router.post('text-to-speech', (req, res) => {
  let languageCode = 'ja-JP';
  let ssmlGender = 'NEUTRAL';
  let audioEncoding = 'LINEAR16';
  let text = 'こんにちは';
  
  if ('languageCode' in req.body) {
    languageCode = req.body.languageCode;
  }

  if ('ssmlGender' in req.body) {
    ssmlGender = req.body.ssmlGender;
  }

  if ('audioEncoding' in req.body) {
    audioEncoding = req.body.audioEncoding;
  }

  if ('text' in req.body) {
    text = req.body.text;
  }

  // Construct the request
  const request = {
    input: { text },
    // Select the language and SSML Voice Gender (optional)
    voice: { languageCode, ssmlGender, },
    // Select the type of audio encoding
    audioConfig: { audioEncoding, },
  };
  
  // Performs the Text-to-Speech request
  client.synthesizeSpeech(request, (err, response) => {
    if (err) {
      console.error('ERROR:', err);
      res.send('NG');
      return;
    }

    const mp3filepath = '/tmp/output.mp3';
  
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
}

module.exports = router;
