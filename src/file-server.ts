import * as path from "path"
import * as fs from "fs"

const multer = require("multer")
import { mkdirp } from "mkdirp"

const upload = function (req, res, basePath, dirPath, filenameCallback = null) {
  const destPath = path.join(basePath, dirPath)
  if (path.normalize(destPath).indexOf(path.normalize(basePath)) != 0) {
    return res.status(403).send("invalid dirname.")
  }
  mkdirp(destPath).then((err) => {
    if (err) {
      return res.status(500).json(err)
    }
    const storage = multer.diskStorage({
      destination: function (req, file, cb) {
        cb(null, destPath)
      },
      filename: function (req, file, cb) {
        if (filenameCallback) {
          cb(null, filenameCallback(file))
        } else {
          cb(null, file.originalname)
        }
      },
    })
    const upload = multer({ storage: storage }).array("file")
    upload(req, res, function (err) {
      if (err) {
        return res.status(500).json(err)
      }
      return res.status(200).send(
        req.files.map((v) => {
          return { filename: v.filename, size: v.size }
        })
      )
    })
  })
}

const readDir = function (req, res, basePath, dirPath) {
  const destPath = path.join(basePath, dirPath)
  if (path.normalize(destPath).indexOf(path.normalize(basePath)) != 0) {
    return res.status(403).send("invalid dirname.")
  }
  fs.access(destPath, fs.constants.F_OK, (err) => {
    if (err) {
      return res.status(200).json([])
    }
    mkdirp(destPath).then((err) => {
      if (err) {
        return res.status(500).json(err)
      }
      fs.readdir(destPath, (err, files) => {
        if (err) {
          return res.status(500).json(err)
        }
        res
          .status(200)
          .json(
            files
              .filter((v) => typeof v === "string" && v.indexOf(".") !== 0)
              .filter(
                (v) => [".jpeg", ".jpg", ".png", ".gif"].indexOf(path.extname(v).toLowerCase()) >= 0
              )
          )
      })
    })
  })
}

const deleteFile = function (req, res, basePath, dirPath, filename) {
  const destPath = path.join(basePath, dirPath)
  if (path.normalize(destPath).indexOf(path.normalize(basePath)) != 0) {
    return res.status(403).send("invalid dirname.")
  }
  mkdirp(destPath).then((err) => {
    if (err) {
      return res.status(500).json(err)
    }
    const filePath = path.join(destPath, filename)
    if (path.normalize(filePath).indexOf(path.normalize(destPath)) != 0) {
      return res.status(403).send("invalid filename.")
    }
    fs.unlink(filePath, (err) => {
      if (err) {
        return res.status(500).json(err)
      }
      res.status(200).json({ filename })
    })
  })
}

export { upload, readDir, deleteFile }
