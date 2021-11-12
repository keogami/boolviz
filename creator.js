var $ = document
var isPressed = {}
var mock = function (it) {it()} //mockingbird from lamda-calculus

window.addEventListener('keypress', function (e) {
  switch (e.key) {
    case "i": insert()
        break
    case "s": save()
        break
  }
})
window.addEventListener('keydown', function (e) {
  isPressed[e.key] = true
})
window.addEventListener('keyup', function (e) {
  isPressed[e.key] = false
})

// i wanted to use linear transformations which could have been optimised by the GPU
// but i didn't wanted to add more complexity than absolutely neccessary
var scale = function (natural, transformed) {
  var ratio = transformed / natural
  return function (val) {
    return {
      scaled: val * ratio,
      normalised: val / ratio
    }
  }
}

var fitInConstraints = function (maxWidth, maxHeight, natWidth, natHeight) {
  var newHeight = scale(natWidth, maxWidth)(natHeight).scaled
  if (newHeight <= maxHeight) return {
    width: maxWidth, height: newHeight
  }
  return {
    width: scale(newHeight, maxHeight)(maxWidth).scaled, height: maxHeight
  }
}

var creator = (new function () {
  this.UNSET = Symbol('unset')
  this.INIT = Symbol('INIT')
  this.STARTANIM = Symbol('STARTANIM')
  this.WAITING = Symbol('WAITING')
  this.DRAWING = Symbol('DRAWING')
  this.END = Symbol('END')
  var state = this.UNSET
  var watchList = {}

  this.__defineGetter__('state', function () {
    return state
  })
  this.__defineSetter__('state', function (val) {
    if (typeof val === "symbol") {
      state = val
      watchList[val] && watchList[val].map(mock)
    } else {
      console.warn("Creator's state change was ignored")
    }
  })
  this.when = function (dstate, callback) {
    if (!watchList[dstate]) {
      watchList[dstate] = [callback]
      return
    }
    watchList.push(callback)
  }
  this.ctx = $.querySelector('canvas').getContext('2d')
  this.lineVector = [] // this is a 3D Matrix tho
  this.activeLine = []
  this.exports = {
    varCount: 0,
    viewport: {
      width: 1.0, height: 0.90
    },
    lineVector: [] // This lineVector is different from the one above
  }
  this.image = null
  this.scaler = null
  this.mousePos = null
}())

var plotter = (new function () {
  var cache = this
  var ctx = creator.ctx
  var pointerSize = 4
  var lineWidth = 2
  var scaleFactor = 1

  this.__defineGetter__('scaleFactor', function () {
    return scaleFactor
  })
  this.__defineSetter__('scaleFactor', function (val) {
    lineWidth /= scaleFactor
    pointerSize /= scaleFactor
    
    lineWidth *= val
    pointerSize *= val
    
    scaleFactor = val
  })
  this.plotPointer = function (x, y, color = "black") {
    ctx.beginPath()
    ctx.strokeStyle = color
    ctx.lineWidth = lineWidth
    ctx.ellipse(x, y, pointerSize, pointerSize, Math.PI, 0, 2 * Math.PI)
    ctx.stroke()
    ctx.closePath()
  }
  this.plotTrail = function (pointVector, color = "black") {
    ctx.beginPath()
    ctx.strokeStyle = color
    ctx.lineWidth = lineWidth
    ctx.moveTo(pointVector[0][0], pointVector[0][1])
    pointVector.slice(1).map(function (it) {
      ctx.lineTo(it[0], it[1])
    })
    ctx.stroke()
    ctx.closePath()
  }
  this.plotActiveTrail = function (pointVector) {
    cache.plotTrail(pointVector, "red")
    pointVector.map(function (it) {
      cache.plotPointer(it[0], it[1], "red")
    })
    var last = pointVector[pointVector.length - 1]
    ctx.beginPath()
    ctx.strokeStyle = "red"
    ctx.lineWidth = lineWidth
    ctx.moveTo(last[0], last[1])
    ctx.lineTo(creator.mousePos.x, creator.mousePos.y)
    ctx.stroke()
    ctx.closePath()
  }
}())

var requestFile = function (callback) {
  var input = $.createElement('input')
  input.type = "file"
  input.accept = "image/*"
  input.style.display = "none"
  input.id = "file-input"
  
  $.body.appendChild(input)
  input.onchange = function () {
    callback(this.files[0])
  }
  input.click()

  $.body.removeChild(input)
}

var insert = function () {
  if (creator.state !== creator.UNSET) return

  do {
    creator.exports.varCount = Number(prompt("Enter the number of inputs used by the circuits."))
  } while(isNaN(creator.exports.varCount) || creator.exports.varCount === 0)

  requestFile(function (file) {
    var img = $.createElement('img')
    img.src = URL.createObjectURL(file)
    img.id = 'image-holder'
    img.style.display = "none"
    $.body.appendChild(img)

    creator.image = img
    img.onload = function () {
      creator.state = creator.INIT
    }
  })
}

var save = function () {
  if (!(creator.state === creator.WAITING)) return

  var config = JSON.stringify(creator.exports, null, 2)

  var execParamList = []
  for (var i = 0; i < creator.exports.varCount; i++) {
    execParamList.push(String.fromCharCode(0x61 + i))
  }
  var execParams = execParamList.map(function (it) {return it + " = false"}).join(", ")

  var inputList = execParamList.map(function (it) {return '"' + it + '"'}).join(", ")

  var fileReader = new FileReader()
  fileReader.onload = function () {
    var backgroundImg = this.result

    var xhr = new XMLHttpRequest()
    xhr.open("get", "final.template")
    xhr.onload = function () {
      var template = new Template(xhr.responseText)

      template.bindComponent("config", config)
      template.bindComponent("backgroundImg", backgroundImg)
      template.bindComponent("execParams", execParams)
      template.bindComponent("inputList", inputList)

      var compiled = template.compile()

      var result = new File([compiled], "final.html", {text: "text/html"})
      downloadFile(result)
    }
    xhr.send()
  }
  requestFile(function (file) {
    fileReader.readAsDataURL(file)
  })
}

var downloadFile = function (file) {
  var a = $.createElement('a')
  a.style.display = "none"
  
  var url = URL.createObjectURL(file)
  a.href = url

  a.download = file.name
  $.body.appendChild(a)
  a.click()
  $.body.removeChild(a)
}

//init event
creator.when(creator.INIT, function () {
  var realWidth = creator.image.width
  var realHeight = creator.image.height
  var transformed = fitInConstraints(innerWidth * 0.98, innerHeight * 0.98, realWidth, realHeight)

  creator.ctx.canvas.width = realWidth
  creator.ctx.canvas.height = realHeight
  creator.ctx.canvas.style.width = transformed.width
  creator.ctx.canvas.style.height = transformed.height
  creator.ctx.canvas.classList.add('init')

  creator.scaler = scale(realWidth, transformed.width)
  creator.state = creator.STARTANIM
})

//start animation sequence
creator.when(creator.STARTANIM, function () {
  var ctx = creator.ctx
  var scaler = creator.scaler
  var animId = null
  var image = creator.image
  var mousePos = {
    x: 50, y: 50
  }

  ctx.canvas.addEventListener('mousemove', function (e) {
    // THE most hideous shit i have ever written
    // But it performs only the needed calculations... so okay
    if (isPressed["v"] && creator.state === creator.DRAWING) {
      mousePos.x = creator.activeLine[creator.activeLine.length - 1][0]
    } else {
      mousePos.x = scaler(e.clientX - ctx.canvas.offsetLeft - 1).normalised
    }
    if (isPressed["h"] && creator.state === creator.DRAWING) {
      mousePos.y = creator.activeLine[creator.activeLine.length - 1][1]
    } else {
      mousePos.y = scaler(e.clientY - ctx.canvas.offsetTop - 1).normalised
    }
  })

  creator.mousePos = mousePos
  plotter.scaleFactor = scaler(1).normalised
  
  var draw = function () {
    if (creator.state === creator.END) {
      cancelAnimationFrame(animId)
      return
    }

    ctx.drawImage(image, 0, 0)
    plotter.plotPointer(mousePos.x, mousePos.y)
    creator.lineVector.map(plotter.plotTrail)
    if (creator.state === creator.DRAWING) {
      plotter.plotActiveTrail(creator.activeLine)
    }

    animId = requestAnimationFrame(draw)
  }
  requestAnimationFrame(draw)
  creator.state = creator.WAITING
})

//Wait for the user to click once
creator.when(creator.WAITING, function () {
  var handler = function () {
    creator.ctx.canvas.removeEventListener('click', handler)
    creator.activeLine.push([creator.mousePos.x, creator.mousePos.y])
    creator.state = creator.DRAWING
  }
  creator.ctx.canvas.addEventListener('click', handler)
})

//Draw Phase: record all the coord until user either pushes "o" or "x"
creator.when(creator.DRAWING, function () {
  var clickHandler = function () {
    creator.activeLine.push([creator.mousePos.x, creator.mousePos.y])
  }
  creator.ctx.canvas.addEventListener('click', clickHandler)

  var pressHandle = function (e) {
    if (!(e.key === "o" || e.key === "x")) return
    creator.ctx.canvas.removeEventListener('click', clickHandler)
    window.removeEventListener('keypress', pressHandle)
    if (e.key === "o") {
      creator.lineVector.push(creator.activeLine)
      var startsJoint = confirm("Does this line starts as a join?")
      var activationSeq = prompt("Enter the Boolean expression for the line.")
      
      // TODO: sanitize activationSeq

      creator.exports.lineVector.push({
        trace: creator.activeLine,
        startsJoint: startsJoint,
        activationSeq: activationSeq
      })
    }
    creator.activeLine = []
    creator.state = creator.WAITING
  }
  window.addEventListener('keypress', pressHandle)
})