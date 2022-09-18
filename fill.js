async function flood(pixels, width, height, x, y, color, cb) {
	let pcount = new Pixels(new ImageData(width, height))
	let old = pixels[x + y*width]
	if (old==color) // would cause an infinite loop
		return false
	
	function log(x,y) {
		let p = pcount[x+y*width]
		if (!p)
			pcount[x+y*width] = 0xFFFF0000
		else if (p==0xFFFF0000)
			pcount[x+y*width] = 0xFFFFFF00
		else if (p==0xFFFFFF00)
			pcount[x+y*width] = 0xFF008000
		else if (p==0xFF008000)
			pcount[x+y*width] = 0xFF00FFFF
		else if (p==0xFF00FFFF)
			pcount[x+y*width] = 0xFF0000FF
		return pixels[x + y*width]==old
	}
	
	let scan = async (x, dx, limit, y)=>{
		while (x!=limit+dx && log(x,y)) {
			pixels[x + y*width] = color
			x += dx
		}
		return x-dx
	}
	
	let queue = [[x+1, x, y, -1]]
	
	let find_spans = async (left, right, y, dy)=>{
		if (y<0 || y>=height)
			return
		for (let x=left; x<=right; x++) {
			let stop = await scan(x, +1, right, y)
			if (stop >= x) {
				cb(pcount)
				await {then:x=>setTimeout(x,20)}
				queue.push([x, stop, y, dy])
				x = stop
			}
		}
	}
	
	while (queue.length) {
		let [x1, x2, y, dy] = queue.pop()
		// expand span
		let left = await scan(x1-1, -1, 0, y)
		let right = await scan(x2+1, +1, width-1, y)
		// check row "behind" span
		if (x2<x1) {
			// this only happens on the first iteration
			await find_spans(left, right, y-dy, -dy)
		} else {
			// we subtract 2 because we know there's a wall on either side of the parent span
			await find_spans(left, x1-2, y-dy, -dy)
			await find_spans(x2+2, right, y-dy, -dy)
		}
		// check row "in front of" span
		await find_spans(left, right, y+dy, dy)
	}
}

		//opt to do:
		// say we're scanning upwards from prev line (i.e. from a coordinate pushed by queue.push(x,y-1))
		// we only need to scan downwards if we are past the original extent
		// ex:
		// ##!!!!!!!!!!!!!!!!!!!!!!!
		// ##***********************#
		// ##!!!!!!###ffffffffffffff#
		// where "f" is the pixels filled by that previous row
		// and * is the extent of the current row
		// we only need to check pixels marked with "!"
		
		// SO: `f` should push a SPAN, not individual pixels:
		
		// todo: -should this span be extended before pushed to stack?
		
		// Each span has:
		// - y coordinate
		// - start x (`[`)
		// - end x (`]`)
		// - direction (up `^` or down `v`)
		```
		// 1: pop a span from the stack:
		// ██████        ██      ███
		// ███       [^^^^^^^]     █
		// █      ███▓▓▓▓▓▓▓▓▓██████
		
		// 2: scan left and right, to extend the span:
		// ██████        ██      ███
		// ██◙◌◌◌◌◌◌◌[^^^^^^^]◌◌◌◌◌◙
		// █      ███▓▓▓▓▓▓▓▓▓██████
		
		// 3: fill that area:
		// ██████        ██      ███
		// ███▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒█
		// █      ███▓▓▓▓▓▓▓▓▓██████
		
		// 4: scan the rows above and below:
		// ███◙◙◙◌◌◌◌◌◌◌◌◙◙◌◌◌◌◌◌◙◙█
		// ███▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒█
		// █  ◌◌◌◌◙◙◙▓▓▓▓▓▓▓▓▓◙◙◙◙◙█
		// Optimization: don't check the area
      // directly below the original span
      // (or above, if it was 'facing' downwards)
      // since we know that's already been filled
      // by whoever pushed that span to the stack

		// identify spans. push them to the stack:
		// ██████[^^^^^^]██[^^^^]███
		// ███▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒▒█
		// █  [vv]███▓▓▓▓▓▓▓▓▓██████
		```
