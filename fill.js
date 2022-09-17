function flood(x, y) {
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
	let find_spans = (start, end, y, dy)=>{
		y+=dy
		if (y<0 || y>=height)
			return
		for (let x=start; x<=end; x++) {
			let stop = scan(x-1, +1, end, y)
			if (stop>=x) {
				queue.push([x, stop, y, dy])
				x = stop
			}
		}
	}
	
	while (queue.length) {
		let [x1,x2,y,dy] = queue.pop()
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
