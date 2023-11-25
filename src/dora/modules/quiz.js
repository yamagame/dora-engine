const utils = require("../libs/utils");
const path = require("path");

function QuizButton(type, node, msg, options, isTemplated) {
  if (typeof msg.quiz === "undefined") msg.quiz = utils.quizObject();
  let message = options;
  if (isTemplated) {
    message = utils.mustache.render(message, msg);
  }
  if (msg.quiz.pages.length > 0) {
    const page = msg.quiz.pages[msg.quiz.pages.length - 1];
    const params = {
      value: message,
    };
    if (type.indexOf("image") >= 0) {
      params.image = message;
    }
    if ("quizOptions" in msg) {
      const options = msg.quizOptions;
      if ("fontScale" in options) params.fontScale = options.fontScale;
      if ("marginTop" in options) params.marginTop = options.marginTop;
    }
    page.choices.push(params);
    if (type.indexOf("ok") >= 0) {
      page.answers.push(message);
    }
  }
  node.send(msg);
}

function QuizOK(node, msg, options, isTemplated) {
  QuizButton("ok", node, msg, options, isTemplated);
}

function QuizOKImage(node, msg, options, isTemplated) {
  QuizButton("ok/image", node, msg, options, isTemplated);
}

function QuizNG(node, msg, options, isTemplated) {
  QuizButton("ng", node, msg, options, isTemplated);
}

function QuizNGImage(node, msg, options, isTemplated) {
  QuizButton("ng/image", node, msg, options, isTemplated);
}

function QuizCategory(node, msg, options, isTemplated) {
  if (typeof msg.quiz === "undefined") msg.quiz = utils.quizObject();
  let category = options;
  if (isTemplated) {
    category = utils.mustache.render(category, msg);
  }
  const page = msg.quiz.pages[msg.quiz.pages.length - 1];
  page.category = category;
  node.send(msg);
}

async function QuizSlide(node, msg, options, isTemplated) {
  if (typeof msg.quiz === "undefined") msg.quiz = utils.quizObject();
  let message = options;
  if (isTemplated) {
    message = utils.mustache.render(message, msg);
  }
  if (path.extname(message.toLowerCase()) == ".json") {
    await node.flow.request({
      type: "quiz",
      action: "slide",
      photo: `${message}`,
      pages: [],
      area: `${message}`,
    });
  } else {
    await node.flow.request({
      type: "quiz",
      action: "slide",
      photo: `${message}`,
      pages: [],
      area: null,
    });
  }
  node.send(msg);
}

module.exports = function (DORA, config) {
  /**
   *
   *
   */
  function QuizGreeting(node, options) {
    node.on("input", async function (msg) {
      if (typeof msg.quiz === "undefined") msg.quiz = utils.quizObject();
      var d = new Date();
      const hours = d.getHours();
      if (hours >= 18 || hours < 5) {
        msg.quiz.greeting = "こんばんわ";
      } else if (hours >= 11) {
        msg.quiz.greeting = "こんにちは";
      } else {
        msg.quiz.greeting = "おはようございます";
      }
      node.send(msg);
    });
  }
  DORA.registerType("greeting", QuizGreeting);

  /**
   *
   *
   */
  function QuizEntry(node, options) {
    node.on("input", async function (msg) {
      if (typeof msg.quiz === "undefined") msg.quiz = utils.quizObject();
      await node.flow.request(
        "command",
        {
          restype: "text",
        },
        {
          type: "quiz",
          action: "wait",
          pages: [],
        }
      );
      await node.flow.request(
        "command",
        {
          restype: "text",
        },
        {
          type: "quiz",
          action: "quiz-entry-init",
          name: "_quiz_master_",
        }
      );
      await node.flow.request(
        "command",
        {
          restype: "text",
        },
        {
          type: "quiz",
          action: "quiz-entry",
          title: msg.quiz.message ? msg.quiz.message.title : null,
          messages: msg.quiz.message ? msg.quiz.message.messages : null,
          backgroundImage: msg.quiz.backgroundImage
            ? msg.quiz.backgroundImage
            : null,
          backgroundColor: msg.quiz.backgroundColor
            ? msg.quiz.backgroundColor
            : null,
          quizMode: msg.quiz.quizMode ? msg.quiz.quizMode : null,
          closeButton: msg.quiz.closeButton ? msg.quiz.closeButton : false,
          links: msg.quiz.message
            ? [
              {
                title: msg.quiz.message.link,
                url: msg.quiz.message.url,
              },
            ]
            : null,
          name: "_quiz_master_",
        }
      );
      node.send(msg);
    });
  }
  DORA.registerType("entry", QuizEntry);

  /**
   *
   *
   */
  function QuizTitle(node, options) {
    node.on("input", function (msg) {
      if (typeof msg.quiz === "undefined") msg.quiz = utils.quizObject();
      msg.quiz.title = options;
      node.send(msg);
    });
  }
  DORA.registerType("title", QuizTitle);

  /**
   *
   *
   */
  function QuizSlideURL(node, options) {
    node.on("input", function (msg) {
      if (typeof msg.quiz === "undefined") msg.quiz = utils.quizObject();
      msg.quiz.slideURL = options;
      node.send(msg);
    });
  }
  DORA.registerType("slideURL", QuizSlideURL);

  /**
   *
   *
   */
  function QuizSlideFunc(node, options) {
    var isTemplated = (options || "").indexOf("{{") != -1;
    node.on("input", async function (msg) {
      await QuizSlide(node, msg, options, isTemplated);
    });
  }
  DORA.registerType("slide", QuizSlideFunc);

  /**
   *
   *
   */
  function QuizEdit(node, options) {
    var isTemplated = (options || "").indexOf("{{") != -1;
    node.on("input", async function (msg) {
      if (typeof msg.quiz === "undefined") msg.quiz = utils.quizObject();
      let message = options;
      if (isTemplated) {
        message = utils.mustache.render(message, msg);
      }
      if (path.extname(message.toLowerCase()) == ".json") {
        await node.flow.request({
          type: "quiz",
          action: "edit",
          photo: `${message}`,
          pages: [],
          area: `${message}`,
        });
      } else {
        await node.flow.request({
          type: "quiz",
          action: "edit",
          photo: `${message}`,
          pages: [],
          area: `${message}.json`,
        });
      }
      node.send(msg);
    });
  }
  DORA.registerType("edit", QuizEdit);

  /**
   *
   *
   */
  function QuizPreload(node, options) {
    var isTemplated = (options || "").indexOf("{{") != -1;
    node.on("input", async function (msg) {
      if (typeof msg.quiz === "undefined") msg.quiz = utils.quizObject();
      let message = options;
      if (isTemplated) {
        message = utils.mustache.render(message, msg);
      }
      const params = {};
      if (typeof msg.cacheSize !== "undefined") {
        params.cacheSize = msg.cacheSize;
      }
      await node.flow.request({
        type: "quiz",
        action: "preload",
        photo: `${message}`,
        params,
        pages: [],
      });
      node.send(msg);
    });
  }
  DORA.registerType("preload", QuizPreload);

  /**
   *
   *
   */
  function QuizStartScreen(node, options) {
    var isTemplated = (options || "").indexOf("{{") != -1;
    node.on("input", async function (msg) {
      if (typeof msg.quiz === "undefined") msg.quiz = utils.quizObject();
      let message = options;
      if (isTemplated) {
        message = utils.mustache.render(message, msg);
      }
      await node.flow.request({
        type: "quiz",
        action: "startScreen",
        photo: `${message}`,
        pages: [],
      });
      node.send(msg);
    });
  }
  DORA.registerType("startScreen", QuizStartScreen);

  /**
   *
   *
   */
  function QuizInit(node, options) {
    var isTemplated = (options || "").indexOf("{{") != -1;
    node.on("input", function (msg) {
      if (typeof msg.quiz === "undefined") msg.quiz = {};
      let message = options;
      if (isTemplated) {
        message = utils.mustache.render(message, msg);
      }
      msg.quiz.timer = 0;
      msg.quiz.pages = [];
      msg.quiz.quizId = message
        ? message
        : msg.quiz.quizId
          ? msg.quiz.quizId
          : msg.quiz.title;
      node.send(msg);
    });
  }
  DORA.registerType("init", QuizInit);

  /**
   *
   *
   */
  function QuizId(node, options) {
    if (!options) {
      throw new Error("クイズIDが指定されていません。");
    }
    var isTemplated = (options || "").indexOf("{{") != -1;
    node.on("input", function (msg) {
      if (typeof msg.quiz === "undefined") msg.quiz = utils.quizObject();
      let message = options;
      if (isTemplated) {
        message = utils.mustache.render(message, msg);
      }
      msg.quiz.quizId = message;
      node.send(msg);
    });
  }
  DORA.registerType("id", QuizId);

  /**
   *
   *
   */
  function QuizShuffle(node, options) {
    node.on("input", async function (msg) {
      if (typeof msg.quiz === "undefined") msg.quiz = utils.quizObject();
      const reset = options && options.indexOf("reset") >= 0;
      await node.flow.request({
        type: "quiz",
        action: "quiz-shuffle",
        reset,
      });
      node.send(msg);
    });
  }
  DORA.registerType("shuffle", QuizShuffle);

  /**
   *
   *
   */
  function QuizTimelimit(node, options) {
    node.on("input", function (msg) {
      if (typeof msg.quiz === "undefined") msg.quiz = utils.quizObject();
      msg.quiz.timeLimit = parseInt(options);
      node.send(msg);
    });
  }
  DORA.registerType("timeLimit", QuizTimelimit);

  /**
   *
   *
   */
  function QuizSelect(node, options) {
    var isTemplated = (options || "").indexOf("{{") != -1;
    node.on("input", function (msg) {
      if (typeof msg.quiz === "undefined") msg.quiz = utils.quizObject();
      let message = options;
      if (isTemplated) {
        message = utils.mustache.render(message, msg);
      }
      msg.quiz.pages.push({
        action: "quiz",
        question: message,
        choices: [],
        answers: [],
        selects: [],
      });
      node.send(msg);
    });
  }
  DORA.registerType("select", QuizSelect);

  /**
   * 選択肢のレイアウトを変更する。指定できるレイアウトはgridのみ。
   * 例) /quiz.select.layout/grid
   */
  function QuizSelectLayout(node, options) {
    var isTemplated = (options || "").indexOf("{{") != -1;
    node.on("input", function (msg) {
      if (typeof msg.quiz === "undefined") msg.quiz = utils.quizObject();
      let layout = options;
      if (isTemplated) {
        layout = utils.mustache.render(layout, msg);
      }
      if (msg.quiz.pages.length > 0) {
        msg.quiz.pages[msg.quiz.pages.length - 1].layout = layout;
      }
      node.send(msg);
    });
  }
  DORA.registerType("select.layout", QuizSelectLayout);

  /**
   * 選択肢を選択状態にする。
   * 例) /quiz.answer/みかん
   */
  function QuizAnswer(node, options) {
    var isTemplated = (options || "").indexOf("{{") != -1;
    node.on("input", function (msg) {
      if (typeof msg.quiz === "undefined") msg.quiz = utils.quizObject();
      let message = options;
      if (isTemplated) {
        message = utils.mustache.render(message, msg);
      }
      if (msg.quiz.pages.length > 0) {
        msg.quiz.pages[msg.quiz.pages.length - 1].selects.push(message);
      }
      node.send(msg);
    });
  }
  DORA.registerType("answer", QuizAnswer);

  /**
   *
   *
   */
  function QuizOptionCategory(node, options) {
    var isTemplated = (options || "").indexOf("{{") != -1;
    node.on("input", function (msg) {
      QuizCategory(node, msg, options, isTemplated);
    });
  }
  DORA.registerType("category", QuizOptionCategory);

  /**
   *
   *
   */
  function QuizOptionOK(node, options) {
    var isTemplated = (options || "").indexOf("{{") != -1;
    node.on("input", function (msg) {
      QuizOK(node, msg, options, isTemplated);
    });
  }
  DORA.registerType("ok", QuizOptionOK);

  /**
   *
   *
   */
  function QuizOptionOKImage(node, options) {
    var isTemplated = (options || "").indexOf("{{") != -1;
    node.on("input", function (msg) {
      QuizOKImage(node, msg, options, isTemplated);
    });
  }
  DORA.registerType("ok.image", QuizOptionOKImage);

  /**
   *
   *
   */
  function QuizOptionNG(node, options) {
    var isTemplated = (options || "").indexOf("{{") != -1;
    node.on("input", function (msg) {
      QuizNG(node, msg, options, isTemplated);
    });
  }
  DORA.registerType("ng", QuizOptionNG);

  /**
   *
   *
   */
  function QuizOptionNGImage(node, options) {
    var isTemplated = (options || "").indexOf("{{") != -1;
    node.on("input", function (msg) {
      QuizNGImage(node, msg, options, isTemplated);
    });
  }
  DORA.registerType("ng.image", QuizOptionNGImage);

  /**
   *
   *
   */
  function QuizOption(key) {
    return function (node, options) {
      var isTemplated = (options || "").indexOf("{{") != -1;
      node.on("input", function (msg) {
        if (key === "reset") {
          delete msg.quizOptions;
        } else {
          if (typeof msg.quizOptions === "undefined") msg.quizOptions = {};
          let value = options;
          if (isTemplated) {
            value = utils.mustache.render(value, msg);
          }
          msg.quizOptions[key] = value;
        }
        node.send(msg);
      });
    };
  }
  DORA.registerType("option.fontScale", QuizOption("fontScale"));
  DORA.registerType("option.marginTop", QuizOption("marginTop"));
  DORA.registerType("option.reset", QuizOption("reset"));

  /**
   *
   *
   */
  function QuizOptionButton(node, options) {
    var isTemplated = (options || "").indexOf("{{") != -1;
    node.on("input", function (msg) {
      if (typeof msg.quiz === "undefined") msg.quiz = utils.quizObject();
      let message = options;
      if (isTemplated) {
        message = utils.mustache.render(message, msg);
      }
      if (msg.quiz.pages.length > 0) {
        msg.quiz.pages[msg.quiz.pages.length - 1].choices.push({
          value: message,
          type: "option",
        });
      }
      node.send(msg);
    });
  }
  DORA.registerType("optionButton", QuizOptionButton);

  /**
   *
   *
   */
  function QuizOptionImageButton(node, options) {
    var isTemplated = (options || "").indexOf("{{") != -1;
    node.on("input", function (msg) {
      if (typeof msg.quiz === "undefined") msg.quiz = utils.quizObject();
      let message = options;
      if (isTemplated) {
        message = utils.mustache.render(message, msg);
      }
      if (msg.quiz.pages.length > 0) {
        msg.quiz.pages[msg.quiz.pages.length - 1].choices.push({
          value: message,
          image: message,
          type: "option",
        });
      }
      node.send(msg);
    });
  }
  DORA.registerType("optionImageButton", QuizOptionImageButton);

  /**
   *
   *
   */
  function QuizImage(node, options) {
    var isTemplated = (options || "").indexOf("{{") != -1;
    node.on("input", function (msg) {
      if (typeof msg.quiz === "undefined") msg.quiz = utils.quizObject();
      let url = options;
      if (isTemplated) {
        url = utils.mustache.render(url, msg);
      }
      if (msg.quiz.pages.length > 0) {
        msg.quiz.pages[msg.quiz.pages.length - 1].sideImage = { url };
      }
      node.send(msg);
    });
  }
  DORA.registerType("sideImage", QuizImage);
  DORA.registerType("image", QuizImage);

  /**
   *
   *
   */
  function QuizIFrame(params) {
    return function (node, options) {
      var isTemplated = (options || "").indexOf("{{") != -1;
      node.on("input", function (msg) {
        if (typeof msg.quiz === "undefined") msg.quiz = utils.quizObject();
        let url = options;
        if (isTemplated) {
          url = utils.mustache.render(url, msg);
        }
        if (msg.quiz.pages.length > 0) {
          msg.quiz.pages[msg.quiz.pages.length - 1].inlineFrame = {
            ...params,
            url,
          };
        }
        node.send(msg);
      });
    };
  }
  DORA.registerType("iframe", QuizIFrame({}));
  DORA.registerType(
    "iframe.offsetBottom.114",
    QuizIFrame({ offsetBottom: 114 })
  );

  /**
   *
   *
   */
  function QuizMessagePage(node, options) {
    var isTemplated = (options || "").indexOf("{{") != -1;
    node.on("input", function (msg) {
      if (typeof msg.quiz === "undefined") msg.quiz = utils.quizObject();
      let message = options;
      if (isTemplated) {
        message = utils.mustache.render(message, msg);
      }
      msg.quiz.pages.push({
        action: "message",
        title: `${message}`,
        messages: ["右上のボタンで次のページへ進んでください。"],
      });
      node.send(msg);
    });
  }
  DORA.registerType("messagePage", QuizMessagePage);

  /**
   *
   *
   */
  function QuizSlidePage(node, options) {
    var isTemplated = (options || "").indexOf("{{") != -1;
    node.on("input", async function (msg) {
      if (typeof msg.quiz === "undefined") msg.quiz = utils.quizObject();
      let message = options;
      if (isTemplated) {
        message = utils.mustache.render(message, msg);
      }
      msg.quiz.pages.push({
        action: "slide",
        photo: `${message}`,
      });
      node.send(msg);
    });
  }
  DORA.registerType("slidePage", QuizSlidePage);

  /**
   *
   *
   */
  function QuizShow(node, options) {
    var isTemplated = (options || "").indexOf("{{") != -1;
    node.on("input", async function (msg) {
      if (typeof msg.quiz === "undefined") msg.quiz = utils.quizObject();
      var option = options || "";
      if (isTemplated) {
        option = utils.mustache.render(option, msg);
      }
      option = option.split("/");
      if (option.indexOf("shuffle") >= 0) {
        //各ページの選択項目のOKの位置を変更する
        msg.quiz.pages.forEach((page, index) => {
          if (page.action === "quiz") {
            const okchoices = [];
            const ngchoices = [];
            page.choices.forEach((a, i) => {
              if (
                page.answers.some(b => {
                  if (typeof a === "object") {
                    return a.value === b;
                  } else {
                    return a === b;
                  }
                })
              ) {
                okchoices.push(a);
              } else {
                ngchoices.push(a);
              }
            });
            const choices = [];
            while (choices.length < page.choices.length) {
              if (choices.length === index % page.choices.length) {
                while (okchoices.length > 0) {
                  choices.push(okchoices.shift());
                }
              } else {
                if (ngchoices.length > 0) {
                  choices.push(ngchoices.shift());
                }
              }
            }
            page.choices = choices;
          }
        });
      }
      const speechButton = option.indexOf("speech-button") >= 0;
      const noSave = option.indexOf("no-save") >= 0;
      const payload = await node.flow.request({
        type: "quiz",
        action: "quiz-show",
        time: msg.quiz.timeLimit,
        pages: msg.quiz.pages,
        pageNumber: 0,
        showSum: false,
        speechButton,
        noSave,
        quizId: msg.quiz.quizId,
      });
      msg.quiz.speechButton = speechButton;
      msg.quiz.noSave = noSave;
      msg.quiz.quizCount = msg.quiz.pages.filter(
        a => a.action == "quiz"
      ).length;
      node.send(msg);
    });
  }
  DORA.registerType("show", QuizShow);

  /**
   *
   * option no-time/half-title/font-small/style-answer/style-deepblue
   */
  function QuizOpen(node, options) {
    var isTemplated = (options || "").indexOf("{{") != -1;
    node.on("input", async function (msg) {
      if (typeof msg.quiz === "undefined") msg.quiz = utils.quizObject();
      var option = options || "";
      if (isTemplated) {
        option = utils.mustache.render(option, msg);
      }
      const params = {
        type: "quiz",
        action: "quiz-init",
        time: msg.quiz.timeLimit,
        pages: msg.quiz.pages,
        pageNumber: 0,
        quizId: msg.quiz.quizId,
        showSum: false,
        options: option.split("/"),
      }
      const payload = await node.flow.request(params);
      msg.showSum = false;
      // console.log(payload);
      msg.quiz.startTime = payload;
      msg.quiz.quizCount = msg.quiz.pages.filter(
        a => a.action == "quiz"
      ).length;
      node.send(msg);
    });
  }
  DORA.registerType("open", QuizOpen);

  /**
   *
   *
   */
  function QuizYesno(node, options) {
    var isTemplated = (options || "").indexOf("{{") != -1;
    node.on("input", async function (msg) {
      if (typeof msg.quiz === "undefined") msg.quiz = utils.quizObject();
      var option = options || "";
      if (isTemplated) {
        option = utils.mustache.render(option, msg);
      }
      const payload = await node.flow.request({
        type: "quiz",
        action: "quiz-init",
        time: msg.quiz.timeLimit,
        pages: msg.quiz.pages,
        pageNumber: 0,
        quizId: msg.quiz.quizId,
        showSum: true,
        options: option.split("/"),
      });
      msg.showSum = true;
      // console.log(payload);
      msg.quiz.startTime = payload;
      msg.quiz.quizCount = msg.quiz.pages.filter(
        a => a.action == "quiz"
      ).length;
      node.send(msg);
    });
  }
  DORA.registerType("yesno", QuizYesno);

  /**
   *
   *
   */
  function QuizQuizPage(node, options) {
    node.on("input", function (msg) {
      if (msg.payload && msg.payload.quiz) msg.quiz = utils.quizObject();
      if (!msg.payload || msg.payload.quiz === null) {
        node.err(new Error("クイズデータエラー。"));
      } else {
        msg.quiz.pages.push({
          action: "quiz",
          question: msg.payload.quiz.question,
          choices: msg.payload.quiz.choices,
          answers: msg.payload.quiz.answers,
          selects: [],
        });
      }
      node.send(msg);
    });
  }
  DORA.registerType("quizPage", QuizQuizPage);

  /**
   *  options: hide-result-message resultMessageを表示しない
   *           minute-mode 残り時間を分単位で表示
   *           radar-chart レーダーチャートを表示する
   *
   */
  function QuizLastPage(node, options) {
    var isTemplated = (options || "").indexOf("{{") != -1;
    node.on("input", function (msg) {
      if (typeof msg.quiz === "undefined") msg.quiz = utils.quizObject();
      var option = options || "";
      if (isTemplated) {
        option = utils.mustache.render(option, msg);
      }
      option = option.split("/");
      //ラストページに結果表示画面を追加
      if (msg.quiz.pages.length > 0) {
        const lastPage = msg.quiz.pages[msg.quiz.pages.length - 1];
        if (lastPage.action !== "result") {
          msg.quiz.pages.push({
            action: "result",
            title: "しばらくお待ちください",
            options: option,
          });
        }
      }
      node.send(msg);
    });
  }
  DORA.registerType("lastPage", QuizLastPage);

  /**
   *
   *
   */
  function QuizWait(node, options) {
    const params = options ? options.split("/") : [];
    if (params.length > 0) {
      node.nextLabel(params.join("/"));
    }
    node.on("input", async function (msg) {
      if (typeof msg.quiz === "undefined") msg.quiz = utils.quizObject();
      await utils.timeout(1000);
      await node.flow.request({
        type: "quiz",
        action: "quiz-start",
        time: msg.quiz.timeLimit - msg.quiz.timer,
        pages: msg.quiz.pages,
        quizId: msg.quiz.quizId,
        quizStartTime: msg.quiz.startTime,
      });
      msg.quiz.timer++;
      if (node.wires.length > 1) {
        if (msg.quiz.timer > msg.quiz.timeLimit) {
          msg.quiz.timer = msg.quiz.timeLimit;
          node.send([msg, null]);
        } else {
          node.send([null, msg]);
        }
      } else {
        node.send(msg);
      }
    });
  }
  DORA.registerType("wait", QuizWait);

  /**
   *
   *
   */
  function QuizStart(node, options) {
    const params = options ? options.split("/") : [];
    if (params.length > 0) {
      node.nextLabel(params.join("/"));
    }
    node.on("input", async function (msg) {
      if (typeof msg.quiz === "undefined") msg.quiz = utils.quizObject();
      await node.flow.request({
        type: "quiz",
        action: "quiz-start",
        time: msg.quiz.timeLimit - msg.quiz.timer,
        pages: msg.quiz.pages,
        quizId: msg.quiz.quizId,
        quizStartTime: msg.quiz.startTime,
      });
      node.send(msg);
    });
  }
  DORA.registerType("start", QuizStart);

  /**
   *
   *
   */
  function QuizTimeCheck(node, options) {
    const params = options.split("/");
    const waitTime = parseInt(params[0]);
    if (params.length > 1) {
      node.nextLabel(params.slice(1).join("/"));
    }
    node.on("input", function (msg) {
      if (typeof msg.quiz === "undefined") msg.quiz = utils.quizObject();
      const { timer, timeLimit } = msg.quiz;
      const n = [];
      if (
        (waitTime < 0 && timer - timeLimit == waitTime) ||
        timer == waitTime
      ) {
        node.jump(msg);
      } else {
        node.next(msg);
      }
    });
  }
  DORA.registerType("timeCheck", QuizTimeCheck);

  /**
   *
   *
   */
  function QuizStop(node, options) {
    node.on("input", async function (msg) {
      if (typeof msg.quiz === "undefined") msg.quiz = utils.quizObject();
      await node.flow.request({
        type: "quiz",
        action: "quiz-stop",
      });
      node.send(msg);
    });
  }
  DORA.registerType("stop", QuizStop);

  /**
   *
   *
   */
  function QuizResult(node, options) {
    let pageNumber = null;
    if (options !== null) {
      if (options === "last") {
        pageNumber = options;
      } else {
        pageNumber = parseInt(options);
      }
    }
    node.on("input", async function (msg) {
      if (typeof msg.quiz === "undefined") msg.quiz = utils.quizObject();
      const { pages } = msg.quiz;
      if (pageNumber === null) {
        let num = 0;
        for (var i = 0; i < pages.length - 1; i++) {
          if (pages[i].action === "quiz") {
            await node.flow.request(
              "command",
              {
                restype: "text",
              },
              {
                type: "quiz",
                action: "quiz-answer",
                pageNumber: i,
              }
            );
            await node.flow.request(
              "text-to-speech",
              {
                restype: "text",
              },
              {
                message: `${num + 1}問目の答えはこれです`,
              }
            );
            await utils.timeout(3000);
            num++;
          }
        }
        await node.flow.request(
          "command",
          {
            restype: "text",
          },
          {
            type: "quiz",
            action: "quiz-answer",
            pageNumber: pages.length - 1,
          }
        );
      } else {
        if (pageNumber === "last") {
          await node.flow.request(
            "command",
            {
              restype: "text",
            },
            {
              type: "quiz",
              action: "quiz-answer",
              pageNumber: pages.length - 1,
            }
          );
        } else {
          await node.flow.request(
            "command",
            {
              restype: "text",
            },
            {
              type: "quiz",
              action: "quiz-answer",
              pageNumber,
            }
          );
        }
      }
      node.send(msg);
    });
  }
  DORA.registerType("result", QuizResult);

  /**
   *
   *
   */
  function QuizResultScore(node, options) {
    let pageNumber = null;
    node.on("input", async function (msg) {
      if (typeof msg.quiz === "undefined") msg.quiz = utils.quizObject();
      const { pages } = msg.quiz;
      await node.flow.request(
        "command",
        {
          restype: "text",
        },
        {
          type: "quiz",
          action: "quiz-answer",
          pageNumber: pages.length - 1,
        }
      );
      node.send(msg);
    });
  }
  DORA.registerType("resultscore", QuizResultScore);
  DORA.registerType("result.score", QuizResultScore);

  /**
   *
   *
   */
  function QuizResultCheck(node, options) {
    let pageNumber = null;
    node.on("input", async function (msg) {
      if (typeof msg.quiz === "undefined") msg.quiz = utils.quizObject();
      const { pages } = msg.quiz;
      let num = 0;
      for (var i = 0; i < pages.length - 1; i++) {
        if (pages[i].action === "quiz") {
          await node.flow.request(
            "command",
            {
              restype: "text",
            },
            {
              type: "quiz",
              action: "quiz-answer",
              pageNumber: i,
            }
          );
          await node.flow.request(
            "text-to-speech",
            {
              restype: "text",
            },
            {
              message: `${num + 1}問目の答えはこれです`,
            }
          );
          await utils.timeout(3000);
          num++;
        }
      }
      node.send(msg);
    });
  }
  DORA.registerType("resultcheck", QuizResultCheck);
  DORA.registerType("result.check", QuizResultCheck);

  /**
   *
   *
   */
  function QuizRanking(node, options) {
    node.nextLabel(options);
    node.on("input", async function (msg) {
      if (typeof msg.quiz === "undefined") msg.quiz = utils.quizObject();
      const quizAnswers = await node.flow.request({
        type: "quiz",
        action: "quiz-ranking",
        name: "_quiz_master_",
        quizId: msg.quiz.quizId,
        pages: msg.quiz.pages,
        quizStartTime: msg.quiz.startTime,
      });
      msg.quiz.quizAnswers = quizAnswers;

      const startTime = new Date(msg.quiz.startTime);
      const result = {};
      const answerCheck = (question, answer) => {
        return msg.quiz.pages.some(page => {
          if (
            typeof page.question !== "undefined" &&
            page.question === question
          ) {
            return page.answers.some(a => a == answer);
          }
        });
      };
      // console.log(msg.quiz.quizAnswers);
      var debugCount = 0;
      const quizCount = msg.quiz.pages.filter(a => a.action == "quiz").length;
      Object.keys(msg.quiz.quizAnswers).forEach(question => {
        const players = msg.quiz.quizAnswers[question];
        Object.keys(players).forEach(clientId => {
          const name = players[clientId].name;
          const answer = players[clientId].answer;
          const time = new Date(players[clientId].time);
          if (typeof result[name] === "undefined") {
            result[name] = { time: time, answer: answer, point: 0 };
          } else if (result[name].time.getTime() < time.getTime()) {
            result[name] = {
              time: time,
              answer: answer,
              point: result[name].point,
            };
          }
          if (answerCheck(question, answer)) {
            result[name].point++;
          }
        });
      });
      const ranking = Object.keys(result)
        .map(name => {
          return {
            name: name,
            time: result[name].time,
            answer: result[name].answer,
            point: result[name].point,
          };
        })
        .filter(p => p.point == quizCount)
        .sort((a, b) => {
          const at = new Date(a.time).getTime();
          const bt = new Date(b.time).getTime();
          return at < bt ? -1 : at > bt ? 1 : 0;
        });
      msg.quizCount = quizCount;
      msg.ranking = ranking;
      msg.debugCount = debugCount;
      // console.log(ranking);
      if (ranking.length === 0) {
        node.send([msg, null]);
      } else {
        node.send([null, msg]);
      }
    });
  }
  DORA.registerType("ranking", QuizRanking);

  /**
   *
   *
   */
  function QuizAnswerCheck(node, options) {
    const params = options.split("/");
    let threshold = null;
    if (params.length > 0) {
      if (params[0].indexOf(":") == 0) {
        node.nextLabel(params.join("/"));
      } else {
        threshold = parseInt(params[0]);
        if (params.length > 1) {
          node.nextLabel(params.slice(1).join("/"));
        }
      }
    }
    node.on("input", async function (msg) {
      if (typeof msg.quiz === "undefined") msg.quiz = utils.quizObject();
      const data = await node.flow.request("result", {
        type: "answers",
        quizId: msg.quiz.quizId,
        startTime: msg.quiz.startTime,
        showSum: msg.showSum,
      });
      const pages = msg.quiz.pages;
      const sumQuestions = {};
      let totalCount = 0;
      let okCount = 0;
      pages.forEach(page => {
        if (page.action === "quiz") {
          const r = {};
          if (data.answers) {
            const t = data.answers[page.question];
            if (t) {
              Object.keys(t).forEach(key => {
                if (typeof r[t[key].answer] === "undefined")
                  r[t[key].answer] = { count: 0 };
                r[t[key].answer].count++;
                data.question.quiz[page.question].answers.forEach(n => {
                  if (n === t[key].answer) {
                    r[t[key].answer].ok = true;
                  }
                });
                if (r[t[key].answer].ok) {
                  okCount++;
                }
                totalCount++;
              });
            }
          }
          sumQuestions[page.question] = r;
        }
      });

      if (msg.quiz.totalCount) {
        totalCount = msg.quiz.totalCount;
      }

      const rate = () => {
        if (totalCount <= 0) {
          //返事がない
          return 0;
        } else if (totalCount === okCount) {
          //全員OK
          return 100;
        } else if (okCount === 0) {
          //全員NG
          return 0;
        } else {
          return (okCount * 100) / totalCount;
        }
      };
      // console.log(JSON.stringify(sumQuestions));
      // console.log(`okCount:${okCount} total:${totalCount}`);
      msg.okCount = okCount;
      msg.totalCount = totalCount;
      if (
        (threshold !== null && rate() >= threshold) ||
        (threshold === null && rate() > 0)
      ) {
        node.jump(msg);
      } else {
        node.next(msg);
      }
    });
  }
  DORA.registerType("answerCheck", QuizAnswerCheck);
  DORA.registerType("answer.check", QuizAnswerCheck);

  /**
   *
   *
   */
  function QuizTotalCount(node, options) {
    var isTemplated = (options || "").indexOf("{{") != -1;
    node.on("input", async function (msg) {
      if (typeof msg.quiz === "undefined") msg.quiz = utils.quizObject();
      if (options) {
        let count = options;
        if (isTemplated) {
          count = utils.mustache.render(count, msg);
        }
        msg.quiz.totalCount = parseInt(count);
      } else {
        msg.quiz.totalCount = 0;
      }
      node.send(msg);
    });
  }
  DORA.registerType("totalCount", QuizTotalCount);
  DORA.registerType("total.count", QuizTotalCount);

  /**
   *
   *
   */
  function initMessage(msg) {
    if (typeof msg.quiz === "undefined") msg.quiz = utils.quizObject();
    if (typeof msg.quiz.title === "undefined") msg.quiz.title = "";
    if (typeof msg.quiz.message === "undefined") msg.quiz.message = {};
    if (typeof msg.quiz.message.messages === "undefined")
      msg.quiz.message.messages = [];
  }

  /**
   *
   *
   */
  function QuizMessageOpen(node, options) {
    node.on("input", function (msg) {
      initMessage(msg);
      msg.quiz.message = {};
      msg.quiz.message.messages = [];
      node.send(msg);
    });
  }
  DORA.registerType("message.open", QuizMessageOpen);

  /**
   *
   *
   */
  function QuizMessageTitle(node, options) {
    var isTemplated = (options || "").indexOf("{{") != -1;
    node.on("input", function (msg) {
      initMessage(msg);
      let message = options;
      if (isTemplated) {
        message = utils.mustache.render(message, msg);
      }
      msg.quiz.message.title = message;
      node.send(msg);
    });
  }
  DORA.registerType("message.title", QuizMessageTitle);

  /**
   *
   *
   */
  function QuizMessageContent(node, options) {
    var isTemplated = (options || "").indexOf("{{") != -1;
    node.on("input", function (msg) {
      initMessage(msg);
      let message = options;
      if (isTemplated) {
        message = utils.mustache.render(message, msg);
      }
      msg.quiz.message.messages.push(message);
      node.send(msg);
    });
  }
  DORA.registerType("message.content", QuizMessageContent);

  /**
   *
   *
   */
  function QuizMessageUrl(node, options) {
    var isTemplated = (options || "").indexOf("{{") != -1;
    node.on("input", function (msg) {
      initMessage(msg);
      let message = options;
      if (isTemplated) {
        message = utils.mustache.render(message, msg);
      }
      msg.quiz.message.url = message;
      node.send(msg);
    });
  }
  DORA.registerType("message.url", QuizMessageUrl);

  /**
   *
   *
   */
  function QuizMessageLink(node, options) {
    var isTemplated = (options || "").indexOf("{{") != -1;
    node.on("input", function (msg) {
      initMessage(msg);
      let message = options;
      if (isTemplated) {
        message = utils.mustache.render(message, msg);
      }
      msg.quiz.message.link = message;
      node.send(msg);
    });
  }
  DORA.registerType("message.link", QuizMessageLink);

  /**
   *
   *
   */
  function QuizMessage(node, options) {
    node.on("input", async function (msg) {
      initMessage(msg);
      await node.flow.request({
        type: "quiz",
        action: "message",
        pages: [],
        title: msg.quiz.message.title,
        messages: msg.quiz.message.messages,
        links: [
          {
            title: msg.quiz.message.link,
            url: msg.quiz.message.url,
          },
        ],
      });
      node.send(msg);
    });
  }
  DORA.registerType("message", QuizMessage);

  /**
   *
   *
   */
  function QuizMoviePlay(node, options) {
    var isTemplated = (options || "").indexOf("{{") != -1;
    node.on("input", async function (msg) {
      initMessage(msg);
      let message = options;
      if (isTemplated) {
        message = utils.mustache.render(message, msg);
      }
      await node.flow.request({
        type: "movie",
        action: "play",
        movie: message,
      });
      node.send(msg);
    });
  }
  DORA.registerType("movie.play", QuizMoviePlay);

  /**
   *
   *
   */
  function QuizMovieCheck(node, options) {
    node.nextLabel(options);
    node.on("input", async function (msg) {
      setTimeout(async () => {
        const res = await node.flow.request({
          type: "movie",
          action: "check",
        });
        try {
          if (res.state === "play") {
            node.jump(msg);
          } else {
            node.next(msg);
          }
        } catch (err) {
          node.jump(msg);
        }
      }, 1000);
    });
  }
  DORA.registerType("movie.check", QuizMovieCheck);

  /**
   *
   *
   */
  function QuizMovieCancel(node, options) {
    node.on("input", async function (msg) {
      await node.flow.request({
        type: "movie",
        action: "cancel",
      });
      node.send(msg);
    });
  }
  DORA.registerType("movie.cancel", QuizMovieCancel);

  /**
   *
   *
   */
  function QuizSpeech(node, options) {
    var isTemplated = (options || "").indexOf("{{") != -1;
    node.on("input", async function (msg) {
      let message = options;
      if (isTemplated) {
        message = utils.mustache.render(message, msg);
      }
      await node.flow.request({
        type: "quiz",
        speech: typeof message === "undefined" ? "" : message,
      });
      node.send(msg);
    });
  }
  DORA.registerType("speech", QuizSpeech);
};

module.exports.QuizOK = QuizOK;
module.exports.QuizNG = QuizNG;
module.exports.QuizOKImage = QuizOKImage;
module.exports.QuizNGImage = QuizNGImage;
module.exports.QuizCategory = QuizCategory;
module.exports.QuizSlide = QuizSlide;
