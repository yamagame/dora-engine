export const calcHasegawaScore = (msg) => {
  let score = 0;
  let result = {};

  if (!msg?.nlp?.store) return score;

  const filter = (a) => {
    if (a) return a.filter((a) => Object.keys(a).length > 0);
    return a;
  };

  // :年齢
  // msg.nlp.store["年齢"][0]["歳"][0].match
  {
    const store = filter(msg.nlp.store["年齢"]);
    let age = [];
    let value = 1;
    if (store) {
      const correctAget = Number(msg.age);
      store
        .filter((a) => "歳" in a)
        .some((a) => {
          return a["歳"].some((a) => {
            const answerAge = Number(a.match);
            age.push(answerAge);
            if (answerAge >= correctAget - 1 && answerAge <= correctAget + 1) {
              // value++;
              return true;
            }
            return false;
          });
        });
    }
    score += value;
    result["年齢"] = { score: value, age };
  }

  // :日時の見当識
  {
    const store = filter(msg.nlp.store["日時の見当識"]);
    let value = 0;
    if (store) {
      const now = new Date(msg.timestamp);
      const correctYear = now.getFullYear();
      const correctMonth = now.getMonth() + 1;
      const correctDate = now.getDate();
      const correctDay = ["日", "月", "火", "水", "木", "金", "土"][
        now.getDay()
      ];
      if (
        store
          .filter((a) => "年" in a)
          .some((a) => a["年"].some((a) => a.match == correctYear))
      ) {
        value++;
      }
      if (
        store
          .filter((a) => "月" in a)
          .some((a) => a["月"].some((a) => a.match == correctMonth))
      ) {
        value++;
      }
      if (
        store
          .filter((a) => "日" in a)
          .some((a) => a["日"].some((a) => a.match == correctDate))
      ) {
        value++;
      }
      if (
        store
          .filter((a) => "曜日" in a)
          .some((a) => a["曜日"].some((a) => a.match == correctDay))
      ) {
        value++;
      }
    }
    score += value;
    result["日時の見当識"] = { score: value };
  }

  // :場所の見当識
  {
    const store1 = filter(msg.nlp.store["場所の見当識1"]);
    const store2 = filter(msg.nlp.store["場所の見当識2"]);
    let value = 0;
    while (true) {
      if (
        store2 &&
        store2
          .filter((a) => "場所" in a)
          .some((a) => a["場所"].some((a) => a.match !== ""))
      ) {
        value++;
        break;
      }
      if (
        store1 &&
        store1
          .filter((a) => "場所" in a)
          .some((a) => a["場所"].some((a) => a.match !== ""))
      ) {
        value += 2;
      }
      break;
    }
    score += value;
    result["場所の見当識"] = { score: value };
  }

  // :言葉の即時記銘
  {
    const store = filter(msg.nlp.store["言葉の即時記銘"]);
    let value = 0;
    if (store) {
      [msg.hasegawa.w1, msg.hasegawa.w2, msg.hasegawa.w3].forEach((word) => {
        if (
          store
            .filter((a) => word in a)
            .some((a) => a[word].some((a) => a.slot === word))
        ) {
          value++;
        }
      });
    }
    score += value;
    result["言葉の即時記銘"] = { score: value };
  }

  // :計算
  {
    const store1 = filter(msg.nlp.store["計算1"]);
    const store2 = filter(msg.nlp.store["計算2"]);
    let value = 0;
    if (store1 || store2) {
      if (
        store1 &&
        store1
          .filter((a) => "数字" in a)
          .some((a) => a["数字"].some((a) => a.match === "93"))
      ) {
        value++;
      }
      if (
        store2 &&
        store2
          .filter((a) => "数字" in a)
          .some((a) => a["数字"].some((a) => a.match === "86"))
      ) {
        value++;
      }
    }
    score += value;
    result["計算"] = { score: value };
  }

  // :数字の逆唱
  {
    const store1 = filter(msg.nlp.store["数字の逆唱1"]);
    const store2 = filter(msg.nlp.store["数字の逆唱2"]);
    let value = 0;
    if (store1 || store2) {
      if (store1 && store1.length > 0) {
        value++;
      }
      if (store2 && store2.length > 0) {
        value++;
      }
    }
    score += value;
    result["数字の逆唱"] = { score: value };
  }

  // :言葉の遅延再生
  {
    const store1 = filter(msg.nlp.store["言葉の遅延再生1"]);
    const store2 = filter(msg.nlp.store["言葉の遅延再生2"]);
    let value = 0;
    if (store1 || store2) {
      [msg.hasegawa.w1, msg.hasegawa.w2, msg.hasegawa.w3].forEach((word) => {
        while (true) {
          if (
            store1 &&
            store1
              .filter((a) => word in a)
              .some((a) => a[word].some((a) => a.slot === word))
          ) {
            value += 2;
            break;
          }
          if (
            store2 &&
            store2
              .filter((a) => word in a)
              .some((a) => a[word].some((a) => a.slot === word))
          ) {
            value++;
          }
          break;
        }
      });
      score += value;
    }
    result["言葉の遅延再生"] = { score: value };
  }

  // :物品記銘
  {
    const store = filter(msg.nlp.store["物品記銘"]);
    let value = 0;
    if (store) {
      ["時計", "くし", "はさみ", "タバコ", "ボールペン"].forEach((word) => {
        if (
          store
            .filter((a) => word in a)
            .some((a) => a[word].some((a) => a.slot === word))
        ) {
          value++;
        }
      });
      score += value;
    }
    result["物品記銘"] = { score: value };
  }

  // :言語の流暢性
  {
    const store = filter(msg.nlp.store["言語の流暢性"]);
    let value = 0;
    if (store) {
      const vegetable = store
        .filter((a) => "野菜" in a)
        .map((a) => a["野菜"])
        .reduce((a, v) => {
          v.forEach((b) => (a[b.match] = b));
          return { ...a };
        }, {});
      const length = Object.entries(vegetable).map((value, index) => {
        return index;
      }).length;
      if (length >= 10) {
        value = 5;
      } else if (length >= 9) {
        value = 4;
      } else if (length >= 8) {
        value = 3;
      } else if (length >= 7) {
        value = 2;
      } else if (length >= 6) {
        value = 1;
      }
      score += value;
    }
    result["言語の流暢性"] = { score: value };
  }

  return { score, result };
};
