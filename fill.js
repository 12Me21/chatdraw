let find_spans = (start,end,y,d)=>{
	for (let x=start; x<=end; x++) {
		if (check(x, y)) {
			let x1 = x
			while (x+1<=end && check(x+1, y))
				x++
			queue.push([x1, x, y, d])
		}
	}
}

while (queue.length) {
	let [x1,x2,y,d] = queue.pop()
	let [left,right] = [x1,x2]
	while (check(left-1,y))
		left--
	while (check(right+1,y))
		right++
	// "above"
	find_spans(left, right, y+d, d)
	// "below"
	find_spans(left, x1-1, y-d, -d)
	find_spans(x2+1, right, y-d, -d)
}
