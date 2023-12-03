export const RobotDB = function (callback) {
  if (callback) callback()
  return {
    findAnswers: () => {
      return { answers: {} }
    },
    updateAnswer: () => {},
    updateQuiz: () => {},
    update: () => {},
    createBar: () => {},
    loadBars: () => {},
    findBars: () => {},
    deleteBar: async () => {},
    updateBar: async () => {},
    loadAttendance: async () => {},
    quizIdList: async () => {},
    startTimeList: async () => {},
    answerAll: async () => {},
    Op: null,
    quizAnswersCache: {},
  }
}
