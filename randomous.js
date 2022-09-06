'use strict'

// Carlos Sanchez - 2017
// randomouscrap98@aol.com
// An enormous library full of garbage

// ---- List of utilities ----
// * HTMLUtilities
// * CanvasUtilities
// * EventUtilities
// * ScreenUtilities
// * MathUtilities

// --- HTMLUtilities ---
// Encode or decode HTML entitities / generate unique IDs for elements / etc.

let HTMLUtilities = {
	_nextID: 0,
	MoveToEnd(element) {
		element.parentNode.appendChild(element)
	},
	GetUniqueID(base) {
		return "genID_" + this._nextID++ + (base ? "_" + base : "")
	},
	CreateUnsubmittableButton(text) {
		let button = document.createElement('button')
		button.type = 'button'
		if (text)
			button.textContent = text
		return button
	},
	CreateContainer(className, id) {
		let container = document.createElement("div")
		container.className = className
		if (id)
			container.id = id
		container.dataset.createdon = new Date().getTime()
		return container
	},
	CreateSelect(options, name) {
		let select = document.createElement("select")
		if (name)
			select.name = name
		for (let i = 0; i < options.length; i++) {
			let option = document.createElement("option")
			if (options[i].value && options[i].text) {
				option.textContent = options[i].text
				option.value = options[i].value
			} else {
				option.textContent = options[i]
			}
			select.appendChild(option)
		}
		return select
	},
	SwapElements(obj1, obj2) {
		// save the location of obj2
		let parent2 = obj2.parentNode
		let next2 = obj2.nextSibling
		// special case for obj1 is the next sibling of obj2
		if (next2 === obj1) {
			// just put obj1 before obj2
			parent2.insertBefore(obj1, obj2)
		} else {
			// insert obj2 right before obj1
			obj1.parentNode.insertBefore(obj2, obj1)
			// now insert obj1 where obj2 was
			if (next2) {
				// if there was an element after obj2, then insert obj1 right before that
				parent2.insertBefore(obj1, next2)
			} else {
				// otherwise, just append as last child
				parent2.appendChild(obj1)
			}
		}
	}
}

// --- Color / Color Utilities ---
// Functions objects for working with colors in a generic way. Any canvas
// functions will use this object rather than some specific format.
class Color {
	constructor(r, g, b, a=1) {
		this.r = r
		this.g = g
		this.b = b
		this.a = a; //This should be a decimal a ranging from 0 to 1
	}
	
	ToArray(expandedAlpha) {
		return [this.r, this.g, this.b, this.a * (expandedAlpha ? 255 : 1)]
	}
	
	ToRGBString() {
		let pre = "rgb"
		let vars = this.r + "," + this.g + "," + this.b
		if (this.a !== 1) {
			pre += "a"
			vars += "," + this.a
		}
		return pre + "(" + vars + ")"
	}
	
	ToHexString(includeAlpha) {
		let string = "#" + this.r.toString(16).padStart(2, "0") + this.g.toString(16).padStart(2, "0") + this.b.toString(16).padStart(2, "0")
		
		if (includeAlpha)
			string += (255 * this.a).toString(16).padStart(2, "0")
		
		return string
	}
	
	//Find the maximum difference between the channels of two colors.
	MaxDifference(compareColor) {
		return Math.max(
			Math.abs(this.r - compareColor.r), 
			Math.abs(this.g - compareColor.g), 
			Math.abs(this.b - compareColor.b), 
			Math.abs(this.a - compareColor.a) * 255)
	}
	
	static from_input(value) {
		let num = parseInt(value.slice(1), 16)
		return new this(num>>16&255, num>>8&255, num&255)
	}
}

// --- CanvasUtilities ---
// Helper functions for dealing with Canvases.

let CanvasUtilities = {
	CreateCopy(canvas, copyImage, x=0, y=0, width=canvas.width, height=canvas.height) {
		// Width and height are cropping, not scaling. X and Y are the place to start the copy within the original canvas 
		let newCanvas = document.createElement('canvas')
		newCanvas.width = width
		newCanvas.height = height
		if (copyImage)
			CanvasUtilities.CopyInto(newCanvas.getContext("2d"), canvas, -x, -y)
		return newCanvas
	},
	CopyInto(context, canvas, x, y) {
		//x and y are the offset locations to place the copy into on the
		//receiving canvas
		x = x || 0
		y = y || 0
		let oldComposition = context.globalCompositeOperation
		context.globalCompositeOperation = "copy"
		CanvasUtilities.OptimizedDrawImage(context, canvas, x, y)
		context.globalCompositeOperation = oldComposition
	},
	OptimizedDrawImage(context, image, x, y, scaleX, scaleY) {
		scaleX = scaleX || image.width
		scaleY = scaleY || image.height
		let oldImageSmoothing = context.imageSmoothingEnabled
		context.imageSmoothingEnabled = false
		context.drawImage(image, Math.floor(x), Math.floor(y), Math.floor(scaleX), Math.floor(scaleY))
		context.imageSmoothingEnabled = oldImageSmoothing
	},
	Clear(canvas, color) {
		let context = canvas.getContext("2d")
		let oldStyle = context.fillStyle
		let oldAlpha = context.globalAlpha
		if (color) {
			context.globalAlpha = 1
			context.fillStyle = color
			context.fillRect(0, 0, canvas.width, canvas.height)
		} else {
			context.clearRect(0, 0, canvas.width, canvas.height)
		}
		context.fillStyle = oldStyle
		context.globalAlpha = oldAlpha
	},
	DrawSolidCenteredRectangle(ctx, cx, cy, width, height, clear) {
		cx = Math.round(cx - width / 2)
		cy = Math.round(cy - height / 2)
		if (clear)
			ctx.clearRect(cx, cy, Math.round(width), Math.round(height))
		else
			ctx.fillRect(cx, cy, Math.round(width), Math.round(height))
		return [cx, cy, width, height]
	},
	DrawSolidEllipse(ctx, cx, cy, radius1, radius2, clear) {
		radius2 = radius2 || radius1
		let line = clear ? "clearRect" : "fillRect"
		let rs1 = radius1 * radius1
		let rs2 = radius2 * radius2
		let rss = rs1 * rs2
		let x, y
		cx -= 0.5; //A HACK OOPS
		cy -= 0.5
		
		for (y = -radius2 + 0.5; y <= radius2 - 0.5; y++) {
			for (x = -radius1 + 0.5; x <= radius1 - 0.5; x++) {
				if (x*x*rs2+y*y*rs1 <= rss) {
					ctx[line](Math.round(cx+x),Math.round(cy+y),Math.round(-x*2 + 0.5),1)
					break
				}
			}
		}
		
		return [cx - radius1, cy - radius2, radius1 * 2, radius2 * 2]
	},
	DrawNormalCenteredRectangle(ctx, cx, cy, width, height) {
		cx = cx - (width - 1) / 2
		cy = cy - (height - 1) / 2
		
		ctx.fillRect(cx, cy, width, height)
		
		return [cx, cy, width, height]
	},
	//For now, doesn't actually draw an ellipse
	DrawNormalCenteredEllipse(ctx, cx, cy, width, height) {
		ctx.beginPath()
		ctx.arc(cx, cy, width / 2, 0, Math.PI * 2, 0)
		ctx.fill()
		
		return [cx - width / 2 - 1, cy - height / 2 - 1, width, width]
	},
	//Wraps the given "normal eraser" function in the necessary crap to get the
	//eraser to function properly. Then you just have to fill wherever necessary.
	PerformNormalEraser(ctx, func) {
		let oldStyle = ctx.fillStyle
		let oldComposition = ctx.globalCompositeOperation
		ctx.fillStyle = "rgba(0,0,0,1)"
		ctx.globalCompositeOperation = "destination-out"
		let result = func()
		ctx.fillStyle = oldStyle
		ctx.globalCompositeOperation = oldComposition
		return result
	},
	//Draws a general line using the given function to generate each point.
	DrawLineRaw(ctx, sx, sy, tx, ty, width, clear, func) {
		let dist = MathUtilities.Distance(sx,sy,tx,ty);     // length of line
		let ang = MathUtilities.SlopeAngle(tx-sx,ty-sy);    // angle of line
		if (dist === 0)
			dist=0.001
		for (let i=0; i<dist; i+=0.5) {
			func(ctx, sx+Math.cos(ang)*i, sy+Math.sin(ang)*i, width, clear)
		}
		//This is just an approximation and will most likely be larger than
		//necessary. It is the bounding rectangle for the area that was updated
		return CanvasUtilities.ComputeBoundingBox(sx, sy, tx, ty, width)
	},
	//How to draw a single point on the SolidSquare line
	_DrawSolidSquareLineFunc(ctx, x, y, width, clear) { 
		CanvasUtilities.DrawSolidCenteredRectangle(ctx, x, y, width, width, clear)
	},
	DrawSolidSquareLine(ctx, sx, sy, tx, ty, width, clear) {
		return CanvasUtilities.DrawLineRaw(ctx, sx, sy, tx, ty, width, clear, CanvasUtilities._DrawSolidSquareLineFunc)
	},
	//How to draw a single point on the SolidRound line
	_DrawSolidRoundLineFunc(ctx, x, y, width, clear) { 
		CanvasUtilities.DrawSolidEllipse(ctx, x, y, width / 2, width / 2, clear)
	},
	DrawSolidRoundLine(ctx, sx, sy, tx, ty, width, clear) {
		return CanvasUtilities.DrawLineRaw(ctx, sx, sy, tx, ty, width, clear, CanvasUtilities._DrawSolidRoundLineFunc)
	},
	//How to draw a single point on the NormalSquare line
	_DrawNormalSquareLineFunc(ctx, x, y, width, clear) { 
		CanvasUtilities.DrawNormalCenteredRectangle(ctx, x, y, width, width, clear)
	},
	DrawNormalSquareLine(ctx, sx, sy, tx, ty, width, clear) {
		if (clear) {
			return CanvasUtilities.PerformNormalEraser(ctx, function() {
				return CanvasUtilities.DrawLineRaw(ctx, sx, sy, tx, ty, width, false, CanvasUtilities._DrawNormalSquareLineFunc)
			})
		} else {
			return CanvasUtilities.DrawLineRaw(ctx, sx, sy, tx, ty, width, false, CanvasUtilities._DrawNormalSquareLineFunc)
		}
	},
	//How to draw a single point on the NormalRound line
	_DrawNormalRoundLineFunc(ctx, x, y, width, clear) { 
		CanvasUtilities.DrawNormalCenteredEllipse(ctx, x, y, width, width, clear)
	},
	DrawNormalRoundLine(ctx, sx, sy, tx, ty, width, clear) {
		if (clear) {
			return CanvasUtilities.PerformNormalEraser(ctx, function() {
				return CanvasUtilities.DrawLineRaw(ctx, sx, sy, tx, ty, width, false, CanvasUtilities._DrawNormalRoundLineFunc)
			})
		} else {
			return CanvasUtilities.DrawLineRaw(ctx, sx, sy, tx, ty, width, false, CanvasUtilities._DrawNormalRoundLineFunc)
		}
	},
	DrawHollowRectangle(ctx, x, y, x2, y2, width) {
		CanvasUtilities.DrawSolidSquareLine(ctx, x, y, x2, y, width)
		CanvasUtilities.DrawSolidSquareLine(ctx, x, y2, x2, y2, width)
		CanvasUtilities.DrawSolidSquareLine(ctx, x, y, x, y2, width)
		CanvasUtilities.DrawSolidSquareLine(ctx, x2, y, x2, y2, width)
		return CanvasUtilities.ComputeBoundingBox(x, y, x2, y2, width)
	},
	ComputeBoundingBox(x, y, x2, y2, width) {
		return [
			Math.min(x, x2) - width, Math.min(y, y2) - width,
			Math.abs(x - x2) + width * 2 + 1, Math.abs(y - y2) + width * 2 + 1
		]
	},
	ComputeTotalBoundingBox(boxes) {
		let finalBox = [ Infinity, Infinity, -Infinity, -Infinity]
		
		for (let i = 0; i < boxes.length; i++) {
			if (!boxes[i] || boxes[i].length < 4)
				return false
			finalBox[0] = Math.min(boxes[0], finalBox[0])
			finalBox[1] = Math.min(boxes[1], finalBox[1])
			finalBox[2] = Math.max(boxes[0] + boxes[2], finalBox[2])
			finalBox[3] = Math.max(boxes[1] + boxes[3], finalBox[3])
		}
		
		return finalBox
	},
	GetColor(context, x, y) {
		let data = context.getImageData(x, y, 1, 1).data
		return new Color(data[0], data[1], data[2], data[3] / 255)
	},
	GetColorFromData(data, i) {
		return new Color(data[i], data[i+1], data[i+2], data[i+3]/255)
	},
	//PutColorInData: function(color, data, i)
	//{
	//   var array = color.ToArray(true)
	//   for (var i = 0; i < 
	//},
	//Convert x and y into an ImageDataCoordinate. Returns -1 if the coordinate
	//falls outside the canvas.
	ImageDataCoordinate(context, x, y) {
		if (x < 0 || x >= context.canvas.width || y < 0 || y >= context.canvas.height)
			return -1
		return 4 * (x + y * context.canvas.width)
	},
	GenericFlood(context, x, y, floodFunction) {
		x = Math.floor(x)
		y = Math.floor(y)
		let canvas = context.canvas
		let iData = context.getImageData(0, 0, canvas.width, canvas.height)
		let data = iData.data
		let queueX = [], queueY = []
		let enqueue = (qx, qy)=>{
			queueX.push(qx)
			queueY.push(qy)
		}
		if (floodFunction(context, x, y, data))
			enqueue(x, y)
		while (queueX.length) {
			let column = queueX.shift()
			let row = queueY.shift()
			//Move west until it is just outside the range we want to fill. Move
			//east in a similar manner.
			let west, east
			for (west = column-1; west>=-1 && floodFunction(context, west, row, data); west--)
				;
			for (east = column+1; east<=canvas.width && floodFunction(context, east, row, data); east++)
				;
			//Move from west to east EXCLUSIVE and fill the queue with matching
			//north and south nodes.
			for (column = west+1; column<east; column++) {
				if (row+1 < canvas.height && floodFunction(context, column, row+1, data))
					enqueue(column, row+1)
				if (row-1 >= 0 && floodFunction(context, column, row-1, data))
					enqueue(column, row-1)
			}
		}
		context.putImageData(iData, 0, 0)
	},
	FloodFill(context, sx, sy, color, threshold) {
		sx = Math.floor(sx)
		sy = Math.floor(sy)
		console.debug("Flood filling starting from " + sx + ", " + sy)
		threshold = threshold || 0
		let originalColor = CanvasUtilities.GetColor(context, sx, sy)
		let ocolorArray = originalColor.ToArray(true)
		let colorArray = color.ToArray(true)
		if (color.MaxDifference(originalColor) <= threshold)
			return
		let floodFunction = (c, x, y, d)=>{
			let i = CanvasUtilities.ImageDataCoordinate(c, x, y)
			let currentColor = new Color(d[i], d[i+1], d[i+2], d[i+3]/255)
			if (originalColor.MaxDifference(currentColor) <= threshold) {
				for (let j = 0; j < 4; j++)
					d[i + j] = colorArray[j]
				return true
			} else {
				return false
			}
		}
		CanvasUtilities.GenericFlood(context, sx, sy, floodFunction)
	},
	SwapColor(context, original, newColor, threshold) {
		let canvas = context.canvas
		let iData = context.getImageData(0, 0, canvas.width, canvas.height)
		let data = iData.data
		let newArray = newColor.ToArray(true)
		
		for (let i = 0; i < data.length; i+=4) {
			let cCol = CanvasUtilities.GetColorFromData(data, i)
			if (cCol.MaxDifference(original) <= threshold) {
				for (let j = 0; j < 4; j++)
					data[i+j] = newArray[j]
			}
		}
		
		context.putImageData(iData, 0, 0)
	},
	ToString(canvas) {
		return canvas.toDataURL("image/png")
	},
	FromString(string) {
		let canvas = document.createElement("canvas")
		let image = new Image()
		image.onload = ev=>{
			canvas.width = image.width
			canvas.height = image.height
			canvas.getContext("2d").drawImage(image, 0, 0)
		}
		image.src = string
		return canvas
	},
	//Draw the image from a data url into the given canvas.
	DrawDataURL(string, canvas, x, y, callback) {
		x = x || 0
		y = y || 0
		let image = new Image()
		image.onload = ev=>{
			canvas.getContext("2d").drawImage(image, x, y)
			if (callback)
				callback(canvas, image)
		}
		image.src = string
	}
}

// --- Event Utilities ---
// Functions to help with built-in events (such as the mouse event).

let EventUtilities = {
	SignalCodes: {Cancel: 2, Run: 1, Wait: 0},
	mButtonMap: [1, 4, 2, 8, 16],
	MouseButtonToButtons(button) {
		return this.mButtonMap[button]
	},
	//This is a NON-BLOCKING function that simply "schedules" the function to be
	//performed later if the signal is in the "WAIT" phase.
	ScheduleWaitingTask(signal, perform, interval) {
		interval = interval || 100
		let s = signal()
		if (s === this.SignalCodes.Cancel)
			return
		else if (s === this.SignalCodes.Run)
			perform()
		else
			window.setTimeout(()=>{
				this.ScheduleWaitingTask(signal, perform, interval)
			}, interval)
	}
}

// --- Math Utilities ---
// Functions which provide extra math functionality.

let MathUtilities = {
	Distance(x1, y1, x2, y2) {
		return Math.sqrt((x2-x1)*(x2-x1)+(y2-y1)*(y2-y1))
	},
	Midpoint(x1, y1, x2, y2) {
		return [x1 + (x2 - x1) / 2, y1 + (y2 - y1) / 2]
	},
	MinMax(value, min, max) {
		if (min > max) {
			let temp = min
			min = max
			max = temp
		}
		return  Math.max(Math.min(value, max), min)
	},
	SlopeAngle(x,y) { 
		return Math.atan(y/(x===0?0.0001:x))+(x<0?Math.PI:0)
	},
	IntRandom(max, min) {
		min = min || 0; //getOrDefault(min, 0)
		
		if (min > max) {
			let temp = min
			min = max
			max = temp
		}
		
		return Math.floor((Math.random() * (max - min)) + min)
	},
	LinearInterpolate(y1, y2, mu) {
		return y1 + mu * (y2 - y1)
	},
	CosInterpolate (y1, y2, mu) {
		let mu2 = (1 - Math.cos(mu * Math.PI)) / 2
		return (y1* (1 - mu2) + y2 * mu2)
	},
	NewGuid() {
		return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g, function(c) {
			return (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16)
		})
	},
	GetSquare(x, y, x2, y2) {
		return [Math.min(x, x2), Math.min(y, y2), Math.abs(x - x2), Math.abs(y - y2)]
	},
	IsPointInSquare(point, square) {
		return point[0] >= square[0] && point[0] <= square[0] + square[2] && point[1] >= square[1] && point[1] <= square[1] + square[3]
	},
	Color: {
		SetGray(f, arr) {
			arr[0] = f
			arr[1] = f
			arr[2] = f
		},
		SetRGB(f, arr) {
			//Duplicate code but fewer branches
			if (f < 0.5) {
				arr[0] = 1 - 2 * f
				arr[2] = 0
			} else {
				arr[0] = 0
				arr[2] = 2 * f - 1
			}
			arr[1] = 1 - Math.abs(f * 2 - 1)
		},
		SetHue(f, arr) {
			if (f < 1 / 6) {
				arr[0] = 1
				arr[1] = f * 6
				arr[2] = 0
			} else if (f < 2 / 6) {
				arr[0] = 1 - (f - 1 / 6) * 6
				arr[1] = 1
				arr[2] = 0
			} else if (f < 0.5) {
				arr[0] = 0
				arr[1] = 1
				arr[2] = (f - 2 / 6) * 6
			} else if (f < 4 / 6) {
				arr[0] = 0
				arr[1] = 1 - (f - 0.5) * 6
				arr[2] = 1
			} else if (f < 5 / 6) {
				arr[0] = (f - 4 / 6) * 6
				arr[1] = 0
				arr[2] = 1
			} else {
				arr[0] = 1
				arr[1] = 0
				arr[2] = 1 - (f - 5 / 6) * 6
			}
		}
	}
}

// --- UndoBuffer ---
// Basically all undo buffers work the same, so here's a generic object you can
// use for all your undo needs

class UndoBuffer {
	constructor(maxSize, maxVirtualIndex) {
		this.maxSize = maxSize || 5
		this.maxVirtualIndex = maxVirtualIndex || this.maxSize
		this.Clear()
	}
	
	Clear() {
		this.undoBuffer = []
		this.redoBuffer = []
		this.virtualIndex = 0
	}
	
	_ShiftVirtualIndex(amount) {
		this.virtualIndex += amount
		while(this.virtualIndex < 0)
			this.virtualIndex += this.maxVirtualIndex
		this.virtualIndex = this.virtualIndex % this.maxVirtualIndex
	}
	
	UndoCount() {
		return this.undoBuffer.length
	}
	RedoCount() {
		return this.redoBuffer.length
	}
	
	Add(currentState) {
		this.undoBuffer.push(currentState)
		this.redoBuffer = []
		this._ShiftVirtualIndex(1)
		while(this.undoBuffer.length > this.maxSize)
			this.undoBuffer.shift()
		return this.UndoCount()
	}
	
	Undo(currentState) {
		if (this.UndoCount() <= 0)
			return
		this.redoBuffer.push(currentState)
		this._ShiftVirtualIndex(-1)
		return this.undoBuffer.pop()
	}
	
	Redo(currentState) {
		if (this.RedoCount() <= 0)
			return
		this.undoBuffer.push(currentState)
		this._ShiftVirtualIndex(1)
		return this.redoBuffer.pop()
	}
	
	ClearRedos() {
		this.redoBuffer = []
	}
}
