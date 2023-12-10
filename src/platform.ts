const { execSync } = require("child_process")

export function arch() {
  try {
    return execSync("cat /proc/device-tree/model 2>&1")
  } catch {}
  return ""
}

export function uname() {
  try {
    return execSync("uname")
  } catch {}
  return ""
}

export function isRaspi() {
  const a = arch()
  return a.toString().startsWith("Raspberry Pi")
}

export function isDarwin() {
  const u = uname()
  return u.toString().startsWith("Darwin")
}

export function isDocker() {
  if (process.env.PULSE_SERVER === "host.docker.internal") return true
  return false
}
