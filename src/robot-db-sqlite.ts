import * as fs from "fs"
import * as path from "path"

export const RobotDB = function (databasePath, options, callback) {
  const Sequelize = require("sequelize")
  const sequelize = new Sequelize(`sqlite:${databasePath}`, options)
  const Op = Sequelize.Op

  const updateQUE = []
  let updating = false

  const Quiz = sequelize.define(
    "quiz",
    {
      quizId: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      startTime: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      name: {
        type: Sequelize.STRING,
      },
    },
    {
      indexes: [
        {
          fields: ["quizId"],
        },
      ],
    }
  )

  const QuizItem = sequelize.define(
    "quizItem",
    {
      quizId: {
        type: Sequelize.INTEGER,
        references: {
          model: Quiz,
          key: "id",
        },
        allowNull: false,
      },
      order: {
        type: Sequelize.INTEGER,
      },
      title: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      choices: {
        type: Sequelize.JSON,
      },
      answers: {
        type: Sequelize.JSON,
      },
    },
    {
      indexes: [
        {
          fields: ["quizId"],
        },
      ],
    }
  )

  const Answer = sequelize.define(
    "answer",
    {
      quizItemId: {
        type: Sequelize.INTEGER,
        references: {
          model: QuizItem,
          key: "id",
        },
        allowNull: false,
      },
      username: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      clientId: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      answer: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      time: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    },
    {
      indexes: [
        {
          fields: ["quizItemId"],
        },
      ],
    }
  )

  const Attendance = sequelize.define(
    "attendance",
    {
      clientId: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      username: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      time: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    },
    {
      indexes: [
        {
          fields: ["time"],
        },
      ],
    }
  )

  const User = sequelize.define(
    "user",
    {
      username: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      kananame: {
        type: Sequelize.STRING,
      },
      password: {
        type: Sequelize.TEXT,
      },
      role: {
        type: Sequelize.STRING,
      },
      idnumber: {
        type: Sequelize.STRING,
      },
      info: {
        type: Sequelize.JSON,
      },
    },
    {
      indexes: [
        {
          fields: ["username"],
        },
      ],
    }
  )

  const Bar = sequelize.define(
    "bar",
    {
      uuid: {
        type: Sequelize.INTEGER,
        allowNull: false,
        unique: true,
      },
      x: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      y: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      width: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      height: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      rgba: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      type: {
        type: Sequelize.STRING,
      },
      title: {
        type: Sequelize.TEXT,
      },
      text: {
        type: Sequelize.TEXT,
      },
      info: {
        type: Sequelize.JSON,
      },
    },
    {
      indexes: [
        {
          fields: ["uuid"],
        },
      ],
    }
  )

  async function findAnswers({ quizId, startTime }) {
    const quiz = await Quiz.findOne({
      where: {
        quizId,
        startTime: new Date(startTime),
      },
    })
    const quizItems = await QuizItem.findAll({
      where: {
        quizId: quiz.id,
      },
      attributes: ["answers", "choices", "title", "quizId", "id"],
    })
    const items = {}
    let r = []
    for (let i = 0; i < quizItems.length; i++) {
      const v = await Answer.findAll({
        where: {
          quizItemId: quizItems[i].id,
        },
        attributes: ["time", "answer", "clientId", "username", "quizItemId", "id"],
      })
      items[quizItems[i].id] = quizItems[i]
      r = r.concat(v)
    }
    const answers = {}
    r.forEach((v) => {
      const a = {
        name: v.username,
        answer: v.answer,
        time: v.time,
        quizStartTime: startTime,
      }
      const title = items[v.quizItemId].title
      if (typeof answers[title] === "undefined") answers[title] = {}
      answers[title][v.clientId] = a
    })
    const question = {}
    quizItems.forEach((v) => {
      const a = {
        choices: v.choices ? v.choices : [],
        answers: v.answers ? v.answers : [],
      }
      question[v.title] = a
    })
    return { answers, question: { quiz: question } }
  }

  async function updateAnswer({
    quizId,
    quizTitle,
    username,
    clientId,
    answerString,
    time,
    startTime,
  }) {
    const quiz = await Quiz.findOrCreate({
      where: {
        quizId,
        startTime: new Date(startTime),
      },
    })
    quiz[0].quizId = quizId
    quiz[0].startTime = new Date(startTime)
    await quiz[0].save()
    const quizItem = await QuizItem.findOrCreate({
      where: {
        quizId: quiz[0].id,
        title: quizTitle,
      },
    })
    quizItem[0].quizId = quiz[0].id
    quizItem[0].title = quizTitle
    await quizItem[0].save()
    const answer = await Answer.findOrCreate({
      where: {
        quizItemId: quizItem[0].id,
        username,
        clientId,
      },
      defaults: {
        answer: answerString,
        time,
        startTime,
      },
    })
    answer[0].quizItemId = quizItem[0].id
    answer[0].username = username
    answer[0].clientId = clientId
    answer[0].answer = answerString
    answer[0].time = new Date(time)
    await answer[0].save()
    const nowTime = new Date(startTime)
    const attend = await Attendance.findOrCreate({
      where: {
        username: answer[0].username,
        clientId: answer[0].clientId,
        time: nowTime,
      },
    })
    attend[0].clientId = answer[0].clientId
    attend[0].username = answer[0].username
    attend[0].time = nowTime
    await attend[0].save()
  }

  async function updateQuiz({
    quizId,
    startTime,
    quizName = "",
    quizOrder,
    quizTitle,
    choices = [],
    answers = [],
  }) {
    const quiz = await Quiz.findOrCreate({
      where: {
        quizId,
        startTime: new Date(startTime),
      },
      defaults: {
        quizId,
        name: quizName,
        startTime: new Date(startTime),
      },
    })
    quiz[0].quizId = quizId
    quiz[0].name = quizName
    quiz[0].startTime = new Date(startTime)
    await quiz[0].save()
    const quizItem = await QuizItem.findOrCreate({
      where: {
        quizId: quiz[0].id,
        title: quizTitle,
      },
      defaults: {
        quizId: quiz.id,
        title: quizTitle,
        order: quizOrder,
        choices: choices,
        answers: answers,
      },
    })
    quizItem[0].quizId = quiz[0].id
    quizItem[0].title = quizTitle
    quizItem[0].order = quizOrder
    quizItem[0].choices = choices
    quizItem[0].answers = answers
    await quizItem[0].save()
    return quizItem[0]
  }

  function update(type, data) {
    updateQUE.push({ type, data })
    const update = () => {
      if (updateQUE.length <= 0) {
        updating = false
        return
      }
      updating = true
      const d = updateQUE.shift()
      if (d.type === "updateAnswer") {
        updateAnswer(d.data)
          .then(() => {
            update()
          })
          .catch((err) => {
            update()
          })
      } else if (d.type === "updateQuiz") {
        updateQuiz(d.data)
          .then(() => {
            update()
          })
          .catch((err) => {
            update()
          })
      } else {
        update()
      }
    }
    if (updating) return
    update()
  }

  async function startTimeList({ quizId }) {
    const quiz = await Quiz.findAll({
      where: { quizId },
      order: [["startTime"]],
      attributes: ["startTime"],
    })
    const startTimes = []
    for (let i = 0; i < quiz.length; i++) {
      const retval = await this.findAnswers({
        quizId,
        startTime: quiz[i].startTime,
      })
      if (retval && retval.answers && Object.keys(retval.answers).length > 0) {
        startTimes.push(quiz[i].startTime)
      }
    }
    return { quizId, startTimes }
  }

  async function quizIdList() {
    const t = await Quiz.findAll({
      attributes: ["quizId"],
      order: [["startTime"]],
    }).map((v) => v.quizId)
    const r = {}
    t.forEach((v) => {
      r[v] = true
    })
    return { quizIds: Object.keys(r) }
  }

  async function loadAttendance() {
    const quizAnswers = {
      q: {},
    }
    await Attendance.findAll().map((v) => {
      if (!quizAnswers.q[v.time]) quizAnswers.q[v.time] = {}
      quizAnswers.q[v.time][v.clientId] = {
        time: v.time,
        name: v.username,
      }
    })
    console.log(JSON.stringify(quizAnswers, null, "  "))
    return {
      quizAnswers,
    }
  }

  async function loadBars() {
    return await Bar.findAll()
  }

  async function createBar(bar, defaultBarData) {
    const barItem = await Bar.create({
      ...defaultBarData,
      ...bar,
    })
    return barItem
  }

  async function updateBar(bar, defaultBarData) {
    if (bar.uuid) {
      const barItem = await Bar.findOrCreate({
        where: {
          uuid: bar.uuid,
        },
        defaults: defaultBarData,
      })
      Object.keys(defaultBarData).forEach((key) => {
        if (typeof bar[key] !== "undefined") {
          barItem[0][key] = bar[key]
        }
      })
      await barItem[0].save()
    }
  }

  async function deleteBar(bar) {
    if (bar.uuid) {
      await Bar.destroy({
        where: {
          uuid: bar.uuid,
        },
      })
    }
  }

  async function findBars(where) {
    return await Bar.findAll({
      where,
    })
  }

  async function answerAll() {
    return {}
  }

  const t = {
    Sequelize,
    sequelize,
    Quiz,
    QuizItem,
    Answer,
    User,
    findAnswers,
    updateAnswer,
    updateQuiz,
    startTimeList,
    quizIdList,
    loadAttendance,
    update,
    loadBars,
    createBar,
    updateBar,
    deleteBar,
    findBars,
    answerAll,
    Op,
    quizAnswersCache: {},
  }

  const a = [Quiz, QuizItem, Answer, Attendance, User, Bar]
  const sync = function () {
    if (a.length <= 0) {
      callback(null, t)
      return
    }
    const b = a.shift()
    b.sync()
      .then(() => {
        sync()
      })
      .catch((err) => {
        callback(err, null)
      })
  }
  sync()

  return t
}

if (require.main === module) {
  const workFolder = "DoraEngine" //for macOS(development)
  const HOME =
    process.platform === "darwin"
      ? path.join(process.env.HOME, "Documents", workFolder)
      : process.env.HOME
  const robotDataPath = path.join(HOME, "robot-data.json")

  const robotJson = fs.readFileSync(robotDataPath, "utf8")
  const robotData = JSON.parse(robotJson)

  const sqeuelize = RobotDB(
    `${HOME}/robot-server.db`,
    {
      operatorsAliases: false,
    },
    async (err, db) => {
      const q = {}

      //問題をデータベースにコピー
      Object.keys(robotData.quizList).forEach((quizId) => {
        const { quiz } = robotData.quizList[quizId]
        Object.keys(quiz).forEach((quizTitle, i) => {
          const quizItem = quiz[quizTitle]
          if (typeof q[quizId] === "undefined") q[quizId] = {}
          q[quizId][quizTitle] = {
            quizId: quizId,
            quizName: quizTitle,
            quizOrder: i,
            quizTitle: quizTitle,
            choices: quizItem.choices,
            answers: quizItem.answers,
          }
        })
      })

      const a = []

      //解答をデータベースにコピー
      Object.keys(robotData.quizAnswers).forEach((quizId) => {
        const quizItem = robotData.quizAnswers[quizId]
        Object.keys(quizItem).forEach((quizTitle) => {
          const answers = quizItem[quizTitle]
          Object.keys(answers).forEach((clientId) => {
            const answer = answers[clientId]
            a.push({
              quizId,
              quizTitle,
              username: answer.name,
              clientId: clientId,
              answerString: answer.answer,
              time: answer.time,
              startTime: answer.quizStartTime,
              choices: q[quizId] && q[quizId][quizTitle] ? q[quizId][quizTitle].choices : null,
              answers: q[quizId] && q[quizId][quizTitle] ? q[quizId][quizTitle].answers : null,
              quizOrder: q[quizId] && q[quizId][quizTitle] ? q[quizId][quizTitle].quizOrder : null,
              quizName: q[quizId] && q[quizId][quizTitle] ? q[quizId][quizTitle].quizName : null,
            })
          })
        })
      })

      for (let i = 0; i < a.length; i++) {
        await db.updateQuiz(a[i])
        await db.updateAnswer(a[i])
      }
      /*
    const list = await db.quizIdList();
    console.log(JSON.stringify(list));

    const time = await db.startTimeList({ quizId: '文字列操作の話' });
    // console.log(JSON.stringify(time));

    const answers = await db.findAnswers({ quizId: '文字列操作の話', startTime: '2018-05-13T02:37:16.823Z' });
    // console.log(JSON.stringify(answers, null, '  '));

    const answerAll = await db.Answer.findAll();
    // console.log(JSON.stringify(answerAll));
*/
    }
  )
}
