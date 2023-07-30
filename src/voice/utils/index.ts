export function MinMax(label) {
  this.min = 0
  this.max = 0
  this.first = true
  this.reset = () => {
    this.min = 0
    this.max = 0
    this.first = true
  }
  this.set = (v) => {
    if (this.first) {
      this.min = v
      this.max = v
      this.first = false
    } else {
      if (this.min > v) this.min = v
      if (this.max < v) this.max = v
    }
  }
  this.print = () => {
    console.log(label, "min", this.min, "max", this.max)
  }
}
