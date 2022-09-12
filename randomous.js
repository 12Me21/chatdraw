'use strict'

class Pixels extends Int32Array {
	constructor(image_data) {
		super(image_data.data.buffer)
		this._image = image_data
	}
	index(x, y) {
		return x + y*this._image.width
	}
	get width() {
		return this._image.width
	}
	get height() {
		return this._image.height
	}
}

class Grp extends CanvasRenderingContext2D {
	constructor(width, height, options) {
		let canvas = document.createElement('canvas')
		canvas.width = width
		canvas.height = height
		let context = canvas.getContext('2d', options)
		return Object.setPrototypeOf(context, new.target.prototype)
	}
	get width() { return this.canvas.width }
	get height() { return this.canvas.height }
	get_data() {
		return this.getImageData(0, 0, this.width, this.height)
	}
	get_pixels(x=0, y=0, width=this.width, height=this.height) {
		return new Pixels(this.getImageData(x, y, width, height))
	}
	put_pixels(pixels, x=0, y=0) {
		this.putImageData(pixels._image, x, y)
	}
	set fill_color(color) {
		this._color = color
		this.fillStyle = color.to_hex()
	}
	get fill_color() {
		return this._color
	}
	clear() {
		this.fillRect(0, 0, this.width, this.height)
	}
	flood_fill(x, y) {
		x = Math.floor(x)
		y = Math.floor(y)
		let pixels = this.get_pixels()
		let {width, height} = pixels
		let queue = []
		let old = pixels[x+y*width]
		let col = this.fill_color.color
		
		let check = (x, y)=>{
			if (x<0 || y<0 || x>=width || y>=height)
				return false
			if (old==pixels[x+y*width]) {
				pixels[x+y*width] = col
				return true
			}
		}
		let check3 = (ok=check(x, y))=>{
			if (ok) {
				if (check(x, y+1))
					queue.push([x, y+1])
				if (check(x, y-1))
					queue.push([x, y-1])
				return true
			}
		}
		if (!check3())
			return
		do {
			let s = x
			do
				x--
			while (check3())
			x = s
			do
				x++
			while (check3())
		} while (queue.length && check3([x,y]=queue.shift()))
		this.put_pixels(pixels)
	}
	replace_color(original) {
		let pixels = this.get_pixels()
		let color = this.fill_color.color
		for (let i=0; i<pixels.length; i++) {
			if (original.color == pixels[i])
				pixels[i] = color
		}
		this.put_pixels(pixels)
	}
	// todo: optimize this, since there's a fixed set of shapes
	// note that cx and cy should be integers or int + 0.5, depending on whether the radius is even or odd..
	draw_circle(cx, cy, radius1, radius2=radius1) {
		let rs1 = radius1 * radius1
		let rs2 = radius2 * radius2
		let rss = rs1 * rs2
		radius2 -= 0.5
		radius1 -= 0.5
		for (let y=-radius2; y<=radius2; y++) {
			for (let x=-radius1; x<=radius1; x++) {
				if (x*x*rs2+y*y*rs1 <= rss) {
					this.fillRect(Math.floor(cx+x), Math.floor(cy+y), Math.floor(-x*2)+1, 1)
					break
				}
			}
		}
	}
	draw_round_line(x1, y1, x2, y2) {
		let lw = this.lineWidth
		// round start/end points
		let [x, y] = CanvasUtilities.correct_pos(x1, y1, lw)
		let [ex, ey] = CanvasUtilities.correct_pos(x2, y2, lw)
		// distance
		let [dx, dy] = [x2-x1, y2-y1]
		// steps
		let [sx, sy] = [Math.sign(dx), Math.sign(dy)]
		//
		let i
		for (i=0;i<500;i++) {
			this.draw_circle(x, y, lw/2, lw/2)
			if (Math.abs(x-ex)+Math.abs(y-ey) <= 1)
				break
			// move in the direction that takes us closest to the ideal line
			let c = dx*(y-y1)-dy*(x-x1)
			let horiz = Math.abs(c-sx*dy)
			let vert = Math.abs(c+sy*dx)
			
			if (sx && horiz<=vert)
				x += sx
			else
				y += sy
		}
		if (i>400)
			console.log('failed', x1,y1,x2,y2, x,y,ex,ey)
		this.draw_circle(ex, ey, lw/2, lw/2)
	}
	draw_box(x, y, x2, y2) {
		let lw = this.lineWidth
		0,[x, y] = CanvasUtilities.correct_pos(x, y, lw)
		0,[x2, y2] = CanvasUtilities.correct_pos(x2, y2, lw)
		x -= lw/2
		y -= lw/2
		x2 += lw/2
		y2 += lw/2
		this.fillRect(x, y, x2-x, lw)
		this.fillRect(x, y, lw, y2-y)
		this.fillRect(x, y2-lw, x2-x, lw)
		this.fillRect(x2-lw, y, lw, y2-y)
	}
	draw_round_line_old(sx, sy, tx, ty) {
		let dx = tx-sx, dy = ty-sy
		let dist2 = dx*dx + dy*dy
		let r = this.lineWidth/2
		if (dist2 == 0) {
			this.draw_circle(sx, sy, r)
		} else {
			let ang = Math.atan2(dy, dx)
			let dist2 = dx*dx + dy*dy
			for (let i=0; i*i<dist2; i+=0.5)
				this.draw_circle(sx+Math.cos(ang)*i, sy+Math.sin(ang)*i, r)
		}
	}
	create_copy() {
		return new this.constructor(this.width, this.height)
	}
}

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
	correct_pos(x, y, bw, bh=bw) {
		x = bw%2 ? Math.floor(x)+0.5 : Math.floor(x+0.5)
		y = bh%2 ? Math.floor(y)+0.5 : Math.floor(y+0.5)
		return [x, y]
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
	IsPointInSquare(point, square) {
		return point[0] >= square[0] && point[0] <= square[0] + square[2] && point[1] >= square[1] && point[1] <= square[1] + square[3]
	},
	random_in_circle(radius) {
		let x, y
		do {
			x = (Math.random()*2-1)*radius
			y = (Math.random()*2-1)*radius
		} while (x*x+y*y>radius*radius)
		return [x,y]
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
