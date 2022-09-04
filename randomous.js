'use strict'

// Carlos Sanchez - 2017
// randomouscrap98@aol.com
// An enormous library full of garbage

// ---- List of utilities ----
// * HTMLUtilities
// * StorageUtilities
// * RequestUtilities
// * StyleUtilities
// * CanvasUtilities
// * EventUtilities
// * ScreenUtilities
// * MathUtilities

// --- Library OnLoad Setup ---
// This stuff needs to be performed AFTER the document is loaded and all that.
document.addEventListener("DOMContentLoaded", ()=>{
	UXUtilities._Setup()
})

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

//Provides toast messages in a container centered near the bottom of the
//screen. You can create multiple toasters, but by default they'll all overlap
//each other. If you need custom styling per toaster, style off the
//container.id
class Toaster {
	constructor() {
		this.minDuration = 2000
		this.maxDuration = 10000
		this.container = false
	}
	
	Attach(toasterParent) {
		Toaster.TrySetDefaultStyles()
		if (this.container)
			throw "Toaster already attached: " + this.container.id
		
		this.container = HTMLUtilities.CreateContainer(Toaster.ContainerClass, HTMLUtilities.GetUniqueID("toastContainer"))
		
		toasterParent.appendChild(this.container)
	}
	
	AttachFullscreen(toasterParent) {
		this.Attach(toasterParent || document.body)
		this.container.dataset.fullscreen = true
	}
	
	Detach() {
		if (!this.container)
			throw "Toaster not attached yet!"
		
		this.container.remove()
		this.container = false
	}
	
	Toast(text, duration) {
		if (!this.container)
			throw "Toaster not attached yet!"
		
		duration = duration || MathUtilities.MinMax(text.length * 50, this.minDuration, this.maxDuration)
		
		let toast = document.createElement("div")
		toast.className = Toaster.ToastClass
		toast.dataset.createdon = new Date().getTime()
		toast.dataset.initialize = true
		toast.dataset.fadingin = true
		toast.textContent = text
		
		console.debug("Popping toast: " + text)
		this.container.appendChild(toast)
		
		setTimeout(()=>{
			delete toast.dataset.initialize
		}, 10)
		//Give a big buffer zone of fadingin just in case people have long effects
		setTimeout(()=>{
			delete toast.dataset.fadingin
		}, 1000)
		setTimeout(()=>{
			toast.dataset.fadingout = true
		}, duration)
		//Give a big buffer zone of fadingout just in case people have long effects
		setTimeout(()=>{
			toast.remove()
		}, duration + 2000)
	}
}

Toaster.ToastClass = "randomousToast"
Toaster.ContainerClass = "randomousToastContainer"
Toaster.StyleID = HTMLUtilities.GetUniqueID("toastStyle")

Toaster.TrySetDefaultStyles = function() {
	let style = StyleUtilities.TrySingleStyle(Toaster.StyleID)
	
	if (style) {
		console.log("Setting up Toast default styles for the first time")
		style.AppendClasses(Toaster.ContainerClass, ["position:absolute","bottom:1em","left:50%","transform:translate(-50%,0)", "z-index:2000000000","pointer-events: none"])
		style.Append("." + Toaster.ContainerClass + "[data-fullscreen]", ["position:fixed"])
		style.AppendClasses(Toaster.ToastClass, ["max-width: 70vw","font-family:monospace","font-size:0.8rem", "padding:0.5em 0.7em","background-color:#EEE","border-radius:0.5em", "color:#333","opacity:1.0","transition: opacity 1s", "display: block", "margin-bottom:0.1em","box-shadow: 0 0 1em -0.3em rgba(0,0,0,0.6)", "overflow: hidden","text-overflow: ellipsis","text-align: center"])
		style.Append("." + Toaster.ToastClass + "[data-fadingout]", ["opacity:0"])
		style.Append("." + Toaster.ToastClass + "[data-initialize]", ["opacity:0"])
		style.Append("." + Toaster.ToastClass + "[data-fadingin]", ["transition:opacity 0.2s"])
	}
}

//Allows fading of any element it's attached to. Element must have position:
//relative or absolute or something.
class Fader {
	Attach(faderParent) {
		Fader.TrySetDefaultStyles()
		if (this.element)
			throw "Tried to attach fader but already attached: " + this.element.id
		this.element = Fader.CreateFadeElement()
		faderParent.appendChild(this.element)
	}
	
	AttachFullscreen(faderParent) {
		this.Attach(faderParent || document.body)
		this.element.dataset.fullscreen = true
	}
	
	Detach() {
		if (!this.element)
			throw "Not attached yet"
		this.element.remove()
		this.element = false
	}
	
	Fade(fadeDuration, color, cover) {
		if (cover)
			this.element.style.pointerEvents = "auto"
		else
			this.element.style.pointerEvents = "none"
		
		this.element.style.transition = "background-color " + fadeDuration + "ms"
		setTimeout(()=>{
			this.element.style.backgroundColor = color
		}, 1)
	}
}

Fader.FaderClass = "randomousFader"
Fader.StyleID = HTMLUtilities.GetUniqueID("faderStyle")

Fader.TrySetDefaultStyles = function() {
	let style = StyleUtilities.TrySingleStyle(Fader.StyleID)
	
	if (style) {
		console.log("Setting up Fader default styles for the first time")
		style.AppendClasses(Fader.FaderClass, ["position:absolute","top:0","left:0","width:100%","height:100%","padding:0","margin:0","pointer-events:none","display:block","z-index:1900000000"])
		style.Append("." + Fader.FaderClass + "[data-fullscreen]", ["width:100vw","height:100vh","position:fixed"])
	}
}

Fader.CreateFadeElement = function() {
	let element = document.createElement("div")
	element.className = Fader.FaderClass
	element.id = HTMLUtilities.GetUniqueID("fader")
	return element
}

//Creates a dialog-box complete with buttons. A good replacement for
//alert/confirm/etc.
class DialogBox {
	constructor() {
		//Since fader is "internal", parameters for fading should be too.
		this.fader = new Fader()
		this.fadeInTime = 100
		this.fadeOutTime = 100
		this.fadeColor = "rgba(0,0,0,0.5)"
		
		this.container = false
	}
	
	Attach(dialogParent) {
		DialogBox.TrySetDefaultStyles()
		if (this.container)
			throw "DialogBox already attached: " + this.container.id
		
		this.container = HTMLUtilities.CreateContainer(DialogBox.ContainerClass, HTMLUtilities.GetUniqueID("dialogContainer"))
		
		this.fader.Attach(dialogParent)
		dialogParent.appendChild(this.container)
	}
	
	AttachFullscreen(dialogParent) {
		this.Attach(dialogParent || document.body)
		this.fader.Detach()
		this.fader.AttachFullscreen(dialogParent)
		this.container.dataset.fullscreen = true
	}
	
	Detach() {
		if (!this.container)
			throw "DialogBox not attached yet!"
		
		this.fader.Detach()
		this.container.remove()
		this.container = false
	}
	
	Show(text, buttons) {
		let dialog = HTMLUtilities.CreateContainer(DialogBox.DialogClass)
		let dialogText = document.createElement("span")
		let dialogButtons = HTMLUtilities.CreateContainer(DialogBox.ButtonContainerClass)
		dialogText.innerHTML = text
		dialogText.className = DialogBox.TextClass
		dialog.appendChild(dialogText)
		dialog.appendChild(dialogButtons)
		
		for (let i = 0; i < buttons.length; i++) {
			let btext = buttons[i]
			if (buttons[i].text)
				btext = buttons[i].text
			let callback = buttons[i].callback
			let newButton = HTMLUtilities.CreateUnsubmittableButton(btext)
			
			newButton.onclick = ev=>{
				dialog.remove()
				
				if (this.container.childNodes.length === 0)
					this.fader.Fade(this.fadeOutTime, "rgba(0,0,0,0)", false)
				
				if (callback)
					callback()
			}
			
			dialogButtons.appendChild(newButton)
		}
		
		this.fader.Fade(this.fadeInTime, this.fadeColor, true)
		this.container.appendChild(dialog)
	}
}

DialogBox.DialogClass = "randomousDialog"
DialogBox.ContainerClass = "randomousDialogContainer"
DialogBox.TextClass = "randomousDialogText"
DialogBox.ButtonContainerClass = "randomousDialogButtonContainer"
DialogBox.StyleID = HTMLUtilities.GetUniqueID("dialogStyle")

DialogBox.TrySetDefaultStyles = function() {
	let style = StyleUtilities.TrySingleStyle(DialogBox.StyleID)
	
	if (style) {
		console.log("Setting up DialogBox default styles for the first time")
		style.AppendClasses(DialogBox.ContainerClass, ["position:absolute","top:50%","left:50%","transform:translate(-50%,-50%)", "padding:0","margin:0","z-index:2000000000"])
		style.Append("." + DialogBox.ContainerClass + "[data-fullscreen]", ["position:fixed"])
		style.AppendClasses(DialogBox.DialogClass, ["max-width: 70vw","font-family:monospace","font-size:1.0rem","padding:1.0em 1.2em","background-color:#EEE","border-radius:0.5em","color:#333","opacity:1.0","transition: opacity 0.2s","display: block","box-shadow: 0 0 1em -0.3em rgba(0,0,0,0.6)"])
		style.AppendClasses(DialogBox.TextClass, ["display: block","font-family: monospace", "overflow: hidden","text-overflow: ellipsis","margin-bottom: 0.5em","white-space:pre-wrap"])
		style.AppendClasses(DialogBox.ButtonContainerClass, ["text-align: center","display: block"])
		style.Append("." + DialogBox.ButtonContainerClass + " button", ["border: none","font-family: monospace", "overflow: hidden","text-overflow: ellipsis","font-size: 1.0em","font-weight:bold","padding: 0.3em 0.5em","margin: 0.2em 0.4em","border-radius:0.35em","background-color: #DDD","display: inline","cursor:pointer"])
		style.Append("." + DialogBox.ButtonContainerClass + " button:hover", ["background-color: #CCC"])
	}
}

// --- UXUtilities ---
// Utilities specifically for User Experience. Things like custom alerts,
// custom confirms, toast, etc. 

let UXUtilities = {
	UtilitiesContainer: HTMLUtilities.CreateContainer("randomousUtilitiesContainer", HTMLUtilities.GetUniqueID("utilitiesContainer")),
	_DefaultToaster: new Toaster(),
	_ScreenFader: new Fader(),
	_DefaultDialog: new DialogBox(),
	_Setup() {
		document.body.appendChild(this.UtilitiesContainer)
		this._DefaultToaster.AttachFullscreen(this.UtilitiesContainer)
		this._ScreenFader.AttachFullscreen(this.UtilitiesContainer)
		this._DefaultDialog.AttachFullscreen(this.UtilitiesContainer)
	},
	Toast(message, duration) { 
		this._DefaultToaster.Toast(message,duration)
	},
	FadeScreen(duration, color) {
		this._ScreenFader.Fade(duration, color)
	},
	Confirm(message, callback, yesMessage, noMessage) {
		this._DefaultDialog.Show(message, [
			{text: noMessage || "No", callback: ()=>{ callback(false) }},
			{text: yesMessage || "Yes", callback: ()=>{ callback(true) }}
		])
	},
	Alert(message, callback, okMessage) {
		this._DefaultDialog.Show(message, [
			{ text: okMessage || "OK", callback: ()=>{
				if (callback)
					callback()
			}}
		])
	}
}

// --- StorageUtilities ---
// Retrieve and store data put into browser storage (such as cookies,
// localstorage, etc.

let StorageUtilities = {
	WriteLocal(name, value) {
		localStorage.setItem(name, JSON.stringify(value))
	},
	ReadLocal(name) {
		try {
			return JSON.parse(localStorage.getItem(name))
		} catch(error) {
			//console.log("Failed to retrieve " + name + " from local storage")
			return undefined
		}
	}
}

// --- Request ---
// Helpers for POST/GET requests

let RequestUtilities = {
	XHRSimple(page, callback, data, extraHeaders) {
		let xhr = new XMLHttpRequest()
		
		if (data)
			xhr.open("POST", page)
		else
			xhr.open("GET", page)
		
		if (extraHeaders) {
			for (let key in extraHeaders) {
				if (extraHeaders.hasOwnProperty(key))
					xhr.setRequestHeader(key, extraHeaders[key])
			}
		}
		
		//Use generic completion function with given success callback
		xhr.onload = event=>{
			try {
				callback(event.target.response)
			} catch(e) {
				console.log("Oops, XHR callback didn't work. Dumping exception")
				console.log(e)
			}
		}
		
		if (data)
			xhr.send(data)
		else
			xhr.send()
	},
	XHRJSON(page, callback, data) {
		RequestUtilities.XHRSimple(page, (response)=>{
			callback(JSON.parse(response))
		}, data, {"Content-type": "application/json"})
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
		let string = "#" + this.r.toString(16).padStart(2, "0") + 
			this.g.toString(16).padStart(2, "0") + 
			this.b.toString(16).padStart(2, "0")
		
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
}

// --- StyleUtilities ---
// Functions for working with styles and colors. Some of these may have a poor
// runtime

let StyleUtilities = {
	_cContext: document.createElement("canvas").getContext("2d"),
	GetColor(input) {
		this._cContext.clearRect(0,0,1,1)
		this._cContext.fillStyle = input
		this._cContext.fillRect(0,0,1,1)
		let data = this._cContext.getImageData(0,0,1,1).data
		return new Color(data[0], data[1], data[2], data[3] / 255)
	},
	_GetColorMath(f, func) {
		let arr = [0,0,0]
		func(f, arr)
		return new Color(255 * arr[0], 255 * arr[1], 255 * arr[2], 1)
	},
	GetGray(f) {
		return StyleUtilities._GetColorMath(f, MathUtilities.Color.SetGray)
	},
	GetRGB(f) {
		return StyleUtilities._GetColorMath(f, MathUtilities.Color.SetRGB)
	},
	GetHue(f) {
		return StyleUtilities._GetColorMath(f, MathUtilities.Color.SetHue)
	},
	//Create a style element WITHOUT inserting it into the head. The given ID
	//will be set. The style element returned will have extra functionality
	//attached to it for easy style appending.
	CreateStyleElement(id) {
		let mStyle = document.createElement("style")
		mStyle.appendChild(document.createTextNode(""))
		mStyle.nextInsert = 0
		mStyle.Append = function(selectors, rules) {
			let i, finalSelectors = []
			if (!Array.isArray(selectors)) selectors = [ selectors ]
			if (!Array.isArray(rules)) rules = [ rules ]
			for (i = 0; i < selectors.length; i++) {
				if (!Array.isArray(selectors[i])) selectors[i] = [ selectors[i] ]
				finalSelectors.push(selectors[i].join(" "))
			}
			mStyle.sheet.insertRule(
				finalSelectors.join(",") + "{" + rules.join(";") + "}", mStyle.nextInsert++)
		}
		mStyle.AppendClasses = function(classnames, rules) {
			let i, j
			if (!Array.isArray(classnames)) classnames = [ classnames ]
			for (i = 0; i < classnames.length; i++) {
				if (!Array.isArray(classnames[i])) classnames[i] = [ classnames[i] ]
				for (j = 0; j < classnames[i].length; j++)
					classnames[i][j] = "." + classnames[i][j]
			}
			mStyle.Append(classnames, rules)
		}
		if (id)
			mStyle.id = id
		return mStyle
	},
	InsertStylesAtTop(styles) {
		if (!Array.isArray(styles)) styles = [ styles ]
		for (let i = styles.length - 1; i >= 0; i--)
			document.head.insertBefore(styles[i], document.head.firstChild)
	},
	TrySingleStyle(id) {
		if (document.getElementById(id))
			return false
		
		let s = StyleUtilities.CreateStyleElement(id)
		StyleUtilities.InsertStylesAtTop(s)
		return s
	},
	//Converts width and height into the true width and height on the device (or
	//as close to it, anyway). Usefull mostly for canvases.
	GetTrueRect(element) {
		window.devicePixelRatio = window.devicePixelRatio || 1
		let pixelRatio = 1
		let rect = element.getBoundingClientRect()
		rect.width = (Math.round(pixelRatio * rect.right) - Math.round(pixelRatio * rect.left)) / 
			window.devicePixelRatio
		rect.height = (Math.round(pixelRatio * rect.bottom) - Math.round(pixelRatio * rect.top)) / 
			window.devicePixelRatio
		return rect
	},
	NoImageInterpolationRules() {
		return ["image-rendering:moz-crisp-edges","image-rendering:crisp-edges", "image-rendering:optimizespeed","image-rendering:pixelated"]
	}
}

StyleUtilities._cContext.canvas.width = StyleUtilities._cContext.canvas.height = 1

// --- CanvasUtilities ---
// Helper functions for dealing with Canvases.

let CanvasUtilities = {
	//WARNING! This function breaks canvases without a style set width or height 
	//on devices with a higher devicePixelRatio than 1 O_O
	AutoSize(canvas) {
		let rect = StyleUtilities.GetTrueRect(canvas)
		canvas.width = rect.width
		canvas.height = rect.height
	},
	//Basically the opposite of autosize: sets the style to match the canvas
	//size.
	AutoStyle(canvas) {
		canvas.style.width = canvas.width + "px"
		canvas.style.height = canvas.height + "px"
	},
	GetScaling(canvas) {
		let rect = StyleUtilities.GetTrueRect(canvas)
		return [rect.width / canvas.width, rect.height / canvas.height]
	},
	//Set scaling of canvas. Alternatively, set the scaling of the given element
	//(canvas will remain unaffected)
	SetScaling(canvas, scale, element) {
		if (!Array.isArray(scale)) scale = [scale, scale]
		let oldWidth = canvas.style.width
		let oldHeight = canvas.style.height
		canvas.style.width = canvas.width + "px"
		canvas.style.height = canvas.height + "px"
		let rect = StyleUtilities.GetTrueRect(canvas)
		if (element) {
			canvas.style.width = oldWidth || ""
			canvas.style.height = oldHeight || ""
		} else {
			element = canvas
		}
		element.style.width = (rect.width * scale[0]) + "px"
		element.style.height = (rect.height * scale[1]) + "px"
	},
	CreateCopy(canvas, copyImage, x, y, width, height) {
		//Width and height are cropping, not scaling. X and Y are the place to
		//start the copy within the original canvas 
		x = x || 0; y = y || 0
		if (width === undefined) width = canvas.width
		if (height === undefined) height = canvas.height
		let newCanvas = document.createElement("canvas")
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
		//The bounding rectangle for the area that was updated on the canvas.
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
		
		//The bounding rectangle for the area that was updated on the canvas.
		return [cx, cy, width, height]
	},
	//For now, doesn't actually draw an ellipse
	DrawNormalCenteredEllipse(ctx, cx, cy, width, height) {
		ctx.beginPath()
		ctx.arc(cx, cy, width / 2, 0, Math.PI * 2, 0)
		ctx.fill()
		
		//The bounding rectangle for the area that was updated on the canvas.
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
		if (dist === 0) dist=0.001
		for (let i=0;i<dist;i+=0.5) {
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
			if (!boxes[i] || boxes[i].length < 4) return false
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
