const utils = require("../libs/utils");
const fetch = require("node-fetch");

function LEDCommon(action = "auto") {
  return function (node, options) {
    var isTemplated = (options || "").indexOf("{{") != -1;
    node.on("input", async function (msg) {
      let option = options;
      if (isTemplated) {
        option = utils.mustache.render(option, msg);
      }
      await node.flow.request({
        type: "led",
        action,
        option,
      });
      node.send(msg);
    });
  };
}

module.exports = function (DORA, config) {
  DORA.registerType("on", LEDCommon("on"));
  DORA.registerType("off", LEDCommon("off"));
  DORA.registerType("blink", LEDCommon("blink"));
  DORA.registerType("auto", LEDCommon("auto"));
  DORA.registerType("talk", LEDCommon("talk"));
};
