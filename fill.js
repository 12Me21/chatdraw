function flood(pixels, width, height, x, y, color) {
	let old = pixels[x + y*width]
	let scan = (x, dx, limit, y)=>{
		while (x!=limit && pixels[x+dx + y*width]==old) {
			pixels[x+dx + y*width] = color
			x += dx
		}
		return x
	}
	
	let queue = [[x+1, x-1, y, -1]]
	
	let find_spans = (left, right, y, dy)=>{
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
		let right = scan(x2, +1, width-1, y)
		// check row in front
		find_spans(left, right, y+dy, dy)
		// check row behind
		find_spans(left, x1-1, y-dy, -dy)
		find_spans(x2+1, right, y-dy, -dy)
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
