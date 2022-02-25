Math.TAU = 2 * Math.PI

const app = new PIXI.Application({ backgroundColor: 0x202020, interactive: true, antialias: true })

let MouseDown, MouseDragX, MouseDragY, MousePositionX, MousePositionY

let BodyManager, CameraManager

const IntegrationModuleEuler = {
    apply: function(bodies, AccelerationModule, dt) {
        bodies.forEach((body, id) => {
            if(body.isStatic)
                return

            body.position.x += body.speed.x * dt
            body.position.y += body.speed.y * dt

            const acceleration = AccelerationModule.acceleration(body, bodies, id)

            body.speed.x += acceleration.x * dt
            body.speed.y += acceleration.y * dt
        })
    }
}
const IntegrationModuleVerlet = {
    apply: function(bodies, AccelerationModule, dt) {
        bodies.forEach((body, id) => {
            if(body.isStatic)
                return

            const k1 = 0.5 * dt * dt
            const k2 = 0.5 * dt

            body.position.x += body.speed.x * dt + body.acceleration.x * k1
            body.position.y += body.speed.y * dt + body.acceleration.y * k1

            const acceleration = AccelerationModule.acceleration(body, bodies, id)

            body.speed.x += (body.acceleration.x + acceleration.x) * k2
            body.speed.y += (body.acceleration.y + acceleration.y) * k2

            body.acceleration.x = acceleration.x
            body.acceleration.y = acceleration.y
        })
    }
}
const AccelerationModuleHooke = {
    acceleration: function(body, bodies, id) {
        return {x: -body.position.x, y: -body.position.y}
    }
}
const AccelerationModuleNewton = {
    acceleration: function(body, bodies, id) {
        const G = 6.67408e-11
        let ax = 0, ay = 0
        bodies.forEach((body2, id2) => {
            if(id2 != id) {
                const distance3 = Math.pow(Math.hypot(body.position.x - body2.position.x
                                                     ,body.position.y - body2.position.y), 3)
                if(distance3 == 0)
                    return
                const k = -G * body2.mass / distance3
                ax += (body.position.x - body2.position.x) * k
                ay += (body.position.y - body2.position.y) * k
            }
        })
        return {x: ax, y: ay}
    }
}

class BodyManagerClass {
    constructor(dt, AccelerationModule, IntegrationModule) {
        this.bodies = []
        this.dt = dt || 0.001
        this.AccelerationModule = AccelerationModule || AccelerationModuleNewton
        this.IntegrationModule  = IntegrationModule  || IntegrationModuleEuler

        this.fontSize = 20
    }
    applyAccelerations() {
        this.IntegrationModule.apply(this.bodies, this.AccelerationModule, this.dt)
    }
    add(x, y, vx, vy, mass, radius, color, name, isStatic) {
        vx = vx || 0
        vy = vy || 0
        mass   = mass   || 1
        radius = radius || 100
        color  = color  || ( Math.floor(Math.random()*256) << 16
                           | Math.floor(Math.random()*256) << 8
                           | Math.floor(Math.random()*256))

        let body = {position:     {x: x,  y: y },
                    speed:        {x: vx, y: vy},
                    acceleration: {x: 0,  y: 0 },
                    mass: mass,
                    radius: radius,
                    color: color,
                    name: name,
                    isStatic: isStatic,
                    graphics: this.drawPlanet(color, radius),
                    graphicsLabel: this.drawPlanetLabel(name, color) }

        this.bodies.push(body)
    }
    remove(i) {
    	app.stage.removeChild(this.bodies[i].graphics)
        app.stage.removeChild(this.bodies[i].graphicsLabel)
        app.stage.removeChild(this.bodies[i].trailGraphics)
        delete this.bodies[i]
    }
    drawPlanet(color, radius)    { return Graphics.circle(0, 0, 100, color) }
    drawPlanetLabel(name, color) { return Graphics.text(0, 0, name, this.fontSize, color, 1) }
}

class CameraManagerClass {
    constructor(pixelScale, radiusScale) {
        this.camera = {x: 0, y: 0}
        this.displayTrails = true
        this.zoomScale     = 1.0
        this.pixelScale    = pixelScale  || 1.0
        this.radiusScale   = radiusScale || 1.0

        this.trailTimer  = 4
        this.trailNumber = 2500
        this.trailColor  = 0xFFFFFF
    }
    loadPlanets() {
        BodyManager.bodies.forEach(body => {
            body.trail = []
            body.trailTimer = 0
            body.trailGraphics = new PIXI.Graphics()
            app.stage.addChild(body.trailGraphics, body.graphics, body.graphicsLabel)
        })
    }
    update() {
        BodyManager.bodies.forEach(body => {
            const camera = this.calculateCamera(body.position)
            const realDiameter = 2 * body.radius * this.rscale()
            body.graphics.x = camera.x
            body.graphics.y = camera.y
            body.graphics.width  = realDiameter
            body.graphics.height = realDiameter
            body.graphicsLabel.x = camera.x
            body.graphicsLabel.y = camera.y + realDiameter/2 + body.graphicsLabel.height/1.5

            body.trailGraphics
                .clear()
                .lineStyle(1, this.trailColor)
                .moveTo(camera.x, camera.y)

            if(this.displayTrails)
                body.trail.forEach(t => {
                    const prev = this.calculateCamera(t)
                    body.trailGraphics.lineTo(prev.x, prev.y)
                })

            body.trailTimer++
            if(body.trailTimer >= this.trailTimer) {
                body.trailTimer = 0
                while(body.trail.length >= this.trailNumber)
                    body.trail.pop()
                body.trail.unshift({ x: body.position.x, y: body.position.y })
            }
        })
    }
    calculateCamera(position) {
        return {x:  (position.x - this.camera.x)*this.scale() + window.innerWidth /2,
                y: -(position.y - this.camera.y)*this.scale() + window.innerHeight/2}
    }
    relativeMove(dx, dy) {
        this.stopFollowing()
        this.camera.x += dx/this.scale()
        this.camera.y += dy/this.scale()
    }
    zoom(delta)     { this.zoomScale *= delta }
    scale()         { return this.pixelScale  * this.zoomScale }
    rscale()        { return this.radiusScale * this.zoomScale }
    stopFollowing() { this.camera = {x: this.camera.x, y: this.camera.y} }
    follow(index)   { this.camera = BodyManager.bodies[index].position }
    resetTrails()   { BodyManager.bodies.forEach(body => { body.trail = [] }) }
    showTrails()    { this.displayTrails ^= true }
    calculateCameraReverse(position) {
        return {x:  (position.x - window.innerWidth /2)/this.scale() + this.camera.x,
                y: -(position.y - window.innerHeight/2)/this.scale() + this.camera.y}
    }
    add(ex, ey, vx, vy, mass) {
        const point = this.calculateCameraReverse({x: ex, y: ey})
        return BodyManager.add(point.x, point.y, vx, vy, mass)
    }
}

class Graphics {
    static line(x1, y1, x2, y2, width, color) {
        return new PIXI.Graphics()
           .lineStyle(width, color, 1)
           .moveTo(x1, y1)
           .lineTo(x2, y2)
    }
    static circle(x, y, radius, fillColor) {
        return new PIXI.Graphics()
            .beginFill(fillColor)
            .drawCircle(x, y, radius)
            .endFill()
    }
    static text(x, y, content, fontSize, color, stroke, strokeThickness) {
        const text = new PIXI.Text(content, new PIXI.TextStyle({
            fontFamily: "Arial",
            fontSize: fontSize,
            fill: color,
            stroke: stroke || 0x000000,
            strokeThickness: strokeThickness || 1
        }))

        text.position.set(x, y)
        text.anchor.set(0.5, 0.5)

        return text
    }
}
