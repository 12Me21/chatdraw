'use strict'

class Pixels extends Uint32Array {
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
	clear(erase=false) {
		if (erase)
			this.clearRect(0, 0, this.width, this.height)
		else
			this.fillRect(0, 0, this.width, this.height)
	}
	flood_fill(x, y) {
		x = Math.floor(x)
		y = Math.floor(y)
		let pixels = this.get_pixels()
		let {width, height} = pixels
		
		let old = pixels[x+y*width]
		let col = Color.int32(this.fillStyle)
		
		let scan = (x, dir, end, y)=>{
			//&& Atomics.compareExchange(pixels, x+dir+y*width, old, col)==old
			while (x!=end && pixels[x+dir + y*width]==old) {
				pixels[x+dir + y*width] = col
				x += dir
			}
			return x
		}
		
		let queue = [[x+1, x-1, y, -1]]
		let find_spans = (left, right, y, dy)=>{
			y+=dy
			if (y<0 || y>=height)
				return
			for (let x=left; x<=right; x++) {
				let stop = scan(x-1, +1, right, y)
				if (stop>=x) {
					queue.push([x, stop, y, dy])
					x = stop
				}
			}
		}
		
		while (queue.length) {
			let [x1, x2, y, dy] = queue.pop()
			// expand current span
			let left = scan(x1, -1, 0, y)
			let right = scan(x2, +1, width, y)
			// "forward"
			find_spans(left, right, y, dy)
			// "backward"
			find_spans(left, x1-1, y, -dy)
			find_spans(x2+1, right, y, -dy)
		}
		
		this.put_pixels(pixels)
	}
	replace_color(original) {
		let pixels = this.get_pixels()
		original = Color.int32(original)
		let color = Color.int32(this.fillStyle)
		for (let i=0; i<pixels.length; i++) {
			if (original == pixels[i])
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
		radius2 += 0.5
		radius1 += 0.5
		// todo: make this work better for non-integer locations?
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
		let [x, y] = Math2.correct_pos(x1, y1, lw)
		let [ex, ey] = Math2.correct_pos(x2, y2, lw)
		// distance
		let [dx, dy] = [x2-x1, y2-y1]
		// steps
		let [sx, sy] = [Math.sign(dx), Math.sign(dy)]
		//
		let i
		//$log.textContent = ""
		//$log.textContent = x1+","+y1+" - "+x2+","+y2+"\n"
		for (i=0;i<500;i++) {
			this.draw_circle(x, y, lw/2, lw/2)
			if (Math.abs(x-x2)<=0.5 && Math.abs(y-y2)<=0.5)
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
		0,[x, y] = Math2.correct_pos(x, y, lw)
		0,[x2, y2] = Math2.correct_pos(x2, y2, lw)
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

let buffer_32 = new Uint32Array(1)
let buffer_8 = new Uint8Array(buffer_32.buffer)
let Color = {
	// return color as an int32 in system endianness, for use with imageData
	int32(hex) {
		let x = parseInt(hex.slice(1), 16)
		buffer_8[0] = x>>>16 // assigning strips upper bits
		buffer_8[1] = x>>>8
		buffer_8[2] = x
		buffer_8[3] = 255
		return buffer_32[0]
	},
	array(hex) {
		let x = parseInt(hex.slice(1), 16)
		return [x>>>16&255, x>>>8&255, x&255, 255]
	}
}

// --- CanvasUtilities ---
// Helper functions for dealing with Canvases.

// --- Math Utilities ---
// Functions which provide extra math functionality.

// x1 + (x2 - x1) / 2
// x1/2 + x2/2

let Math2 = {
	correct_pos(x, y, bw, bh=bw) {
		x = bw%2 ? Math.floor(x)+0.5 : Math.floor(x+0.5)
		y = bh%2 ? Math.floor(y)+0.5 : Math.floor(y+0.5)
		return [x, y]
	},
	distance(x1, y1, x2, y2) {
		return Math.hypot(x2-x1, y2-y1)
	},
	Midpoint(x1, y1, x2, y2) {
		return [(x1+x2)/2, (y1+y2)/2]
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
		this.onchange = null
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
		if (this.onchange)
			this.onchange()
	}
}
