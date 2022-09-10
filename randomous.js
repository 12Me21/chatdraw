'use strict'

// ugh this is messy. how do we REALLY store color?
// varies between "#RRGGBB", "#RRGGBBAA", 0xAABBGGRR (or 0xRRGGBBAA on big endian), and Color class, and [r,g,b,a]

const LITTLE = new Uint8Array(new Uint32Array([5]).buffer)[0] == 5

if (LITTLE) {
	window.Color = class Color {
		constructor(r, g, b, a=255) {
			if (g===undefined)
				this.color = r
			else
				this.color = r|g<<8|b<<16|a<<24
		}
		get r() { return this.color & 255 }
		get g() { return this.color>>>8 & 255 }
		get b() { return this.color>>>16 & 255 }
		get a() { return this.color>>>24 & 255 }
		
		clear_score() { //idk
			return Math.pow(this.r + this.g + this.b - (255 * 3/2 - 0.1), 2)
		}
		
		ToArray() {
			return [this.r, this.g, this.b, this.a]
		}
		
		to_hex() {
			let num = this.r<<16 | this.g<<8 | this.b
			return "#"+num.toString(16).padStart(2*3, "0")
		}
		
		static from_hex(value) {
			let num = parseInt(value.slice(1), 16)
			return new this(num>>>16&255, num>>>8&255, num&255)
		}
	}
} else {
	window.Color = class Color {
		constructor(r, g, b, a=255) {
			if (g===undefined)
				this.color = r
			else
				this.color = r<<24 | g<<16 | b<<8 | a
		}
		get r() { return this.color>>>24 & 255 }
		get g() { return this.color>>>16 & 255 }
		get b() { return this.color>>>8 & 255 }
		get a() { return this.color & 255 }
		
		clear_score() { //idk
			return Math.pow(this.r + this.g + this.b - (255 * 3/2 - 0.1), 2)
		}
		
		ToArray() {
			return [this.r, this.g, this.b, this.a]
		}
		
		to_hex() {
			let num = this.r<<16 | this.g<<8 | this.b
			return "#"+num.toString(16).padStart(2*3, "0")
		}
		
		static from_hex(value) {
			let num = parseInt(value.slice(1), 16)
			return new this(num>>>16&255, num>>>8&255, num&255)
		}
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
		let context = newCanvas.getContext('2d')
		if (copyImage)
			CanvasUtilities.CopyInto(context, canvas, -x, -y)
		return context
	},
	GetAllData(context) {
		let {width, height} = context.canvas
		return context.getImageData(0, 0, width, height)
	},
	CopyInto(context, source, x=0, y=0) {
		//x and y are the offset locations to place the copy into on the receiving canvas
		context.save()
		context.globalCompositeOperation = 'copy'
		context.drawImage(source, x, y)
		context.restore()
	},
	Clear(context, color=null) {
		context.save()
		let op = 'clearRect'
		if (color) {
			context.globalAlpha = 1
			context.fillStyle = color
			op = 'fillRect'
		}
		context[op](0, 0, context.canvas.width, context.canvas.height)
		context.restore()
	},
	// todo: optimize this, since there's a fixed set of shapes
	// note that cx and cy should be integers or int + 0.5, depending on whether the radius is even or odd..
	DrawEllipse(ctx, cx, cy, radius1, radius2=radius1) {
		let rs1 = radius1 * radius1
		let rs2 = radius2 * radius2
		let rss = rs1 * rs2
		radius2 -= 0.5
		radius1 -= 0.5
		for (let y=-radius2; y<=radius2; y++) {
			for (let x=-radius1; x<=radius1; x++) {
				if (x*x*rs2+y*y*rs1 <= rss) {
					ctx.fillRect(Math.floor(cx+x), Math.floor(cy+y), Math.floor(-x*2)+1, 1)
					break
				}
			}
		}
	},
	DrawLine2(ctx, x1, y1, x2, y2, func) {
		let lw = ctx.lineWidth
		let [x,y] = CanvasUtilities.correct_pos(x1, y1, lw)
		let [ex,ey] = CanvasUtilities.correct_pos(x2, y2, lw)
		let dx = x2-x1
		let dy = y2-y1
		let sx = Math.sign(dx)
		let sy = Math.sign(dy)
		let tx = Math.abs(dx)>Math.abs(dy) ? sx : 0
		let ty = tx==0 ? sy : 0
		let i
		for (i=0;i<500;i++) {
			CanvasUtilities.DrawEllipse(ctx, x, y, lw/2, lw/2)
			if (MathUtilities.Distance(x, y, ex, ey)<2)
				break
			let orth = Math.abs(dx*(y+ty-y1)-dy*(x+tx-x1))
			let diag = Math.abs(dx*(y+sy-y1)-dy*(x+sx-x1))
			if (orth<=diag) {
				x += tx
				y += ty
			} else {
				x += sx
				y += sy
			}
		}
		//if (!i)
		CanvasUtilities.DrawEllipse(ctx, ex, ey, lw/2, lw/2)
	},
	//Draws a general line using the given function to generate each point.
	DrawLineRaw(ctx, sx, sy, tx, ty, func) {
		let dx = tx-sx, dy = ty-sy
		let dist2 = dx*dx + dy*dy
		if (dist2 == 0) {
			func(ctx, sx, sy)
		} else {
			let ang = Math.atan2(dy, dx)
			for (let i=0; i*i<dist2; i+=0.5)
				func(ctx, sx+Math.cos(ang)*i, sy+Math.sin(ang)*i)
		}
	},
	DrawRoundLine(ctx, sx, sy, tx, ty) {
		CanvasUtilities.DrawLineRaw(
			ctx, sx, sy, tx, ty,
			(ctx,x,y)=>CanvasUtilities.DrawEllipse(ctx, x, y, ctx.lineWidth/2, ctx.lineWidth/2)
		)
	},
	correct_pos(x, y, bw, bh=bw) {
		x = bw%2 ? Math.floor(x)+0.5 : Math.floor(x+0.5)
		y = bh%2 ? Math.floor(y)+0.5 : Math.floor(y+0.5)
		return [x, y]
	},
	DrawHollowRectangle(ctx, x, y, x2, y2) {
		let lw = ctx.lineWidth
		;[x, y] = CanvasUtilities.correct_pos(x, y, lw)
		;[x2, y2] = CanvasUtilities.correct_pos(x2, y2, lw)
		x -= lw/2
		y -= lw/2
		x2 += lw/2
		y2 += lw/2
		ctx.fillRect(x, y, x2-x, lw)
		ctx.fillRect(x, y, lw, y2-y)
		ctx.fillRect(x, y2-lw, x2-x, lw)
		ctx.fillRect(x2-lw, y, lw, y2-y)
	},
	GetColor(context, x, y) {
		let data = context.getImageData(x, y, 1, 1).data
		return new Color(data[0], data[1], data[2], data[3])
	},
	//Convert x and y into an ImageDataCoordinate. Returns -1 if the coordinate falls outside the data
	ImageDataCoordinate({width, height}, x, y) {
		if (x<0 || x>=width || y<0 || y>=height)
			return -1
		return (x + y * width) * 4
	},
	GenericFlood(context, x, y, func) {
		x = Math.floor(x)
		y = Math.floor(y)
		let data = CanvasUtilities.GetAllData(context)
		let i32 = new Int32Array(data.data.buffer)
		let {width, height} = data
		let queue = []
		let check3 = (ok=func(i32, width, height, x, y))=>{
			if (ok) {
				if (y+1<height && func(i32, width, height, x, y+1)) queue.push([x, y+1])
				if (y-1>=0 && func(i32, width, height, x, y-1)) queue.push([x, y-1])
				return true
			}
		}
		if (!check3())
			return
		do {
			let s = x
			do;while (--x>=0 && check3())
			x = s
			do;while (++x<width && check3())
		} while (queue.length && check3([x,y]=queue.shift()))
		context.putImageData(data, 0, 0)
	},
	SwapColor(context, original, newColor) {
		let iData = CanvasUtilities.GetAllData(context)
		let i32 = new Int32Array(iData.data.buffer)
		for (let i=0; i<i32.length; i++) {
			if (original.color == data[i])
				data[i] = newColor.color
		}
		context.putImageData(iData, 0, 0)
	}
}

// --- Math Utilities ---
// Functions which provide extra math functionality.

let MathUtilities = {
	point_to_line(x, y, x1, y1, x2, y2) {
		let dx = x2-x1, dy = y2-y1
		let dist = Math.abs(dx*(y-y1)-dy*(x-x1)) / Math.sqrt(dx*dx+dy*dy)
		return dist
	},
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
	LinearInterpolate(y1, y2, mu) {
		return y1 + mu * (y2 - y1)
	},
	CosInterpolate(y1, y2, mu) {
		let mu2 = (1 - Math.cos(mu * Math.PI)) / 2
		return (y1* (1 - mu2) + y2 * mu2)
	},
	GetSquare(x, y, x2, y2) {
		return [Math.min(x, x2), Math.min(y, y2), Math.abs(x - x2), Math.abs(y - y2)]
	},
	IsPointInSquare(point, square) {
		return point[0] >= square[0] && point[0] <= square[0] + square[2] && point[1] >= square[1] && point[1] <= square[1] + square[3]
	},
	FindBest(list, func) {
		let best = -Infinity
		let besti = 0
		for (let i=0; i<list.length; i++) {
			let score = func(list[i], i, list)
			if (score > best) {
				best = score
				besti = i
			}
		}
		return [list[besti], besti]
	}
}

// --- UndoBuffer ---
// Basically all undo buffers work the same, so here's a generic object you can use for all your undo needs

class UndoBuffer {
	constructor(maxSize=5) {
		this.maxSize = maxSize
		this.OnUndoStateChange = null
		this.Clear()
	}
	
	Clear() {
		this.buffer = [[],[]] // undo, redo
		this.DoUndoStateChange()
	}
	
	UndoCount() {
		return this.buffer[0].length
	}
	RedoCount() {
		return this.buffer[1].length
	}
	
	Add(current) {
		let undo = this.buffer[0]
		this.buffer[0].push(current)
		this.buffer[1] = []
		while (undo.length > this.maxSize)
			undo.shift()
		this.DoUndoStateChange()
		return undo.length
	}
	
	_do(current, redo) {
		if (!this.buffer[redo?1:0].length)
			return null
		this.buffer[redo?0:1].push(current)
		let data = this.buffer[redo?1:0].pop()
		this.DoUndoStateChange()
		return data
	}
	
	Undo(current) {
		return this._do(current, false)
	}
	
	Redo(current) {
		return this._do(current, true)
	}
	
	ClearRedos() {
		this.buffer[1] = []
		this.DoUndoStateChange()
	}
	
	DoUndoStateChange() {
		if (this.OnUndoStateChange)
			this.OnUndoStateChange()
	}
}
