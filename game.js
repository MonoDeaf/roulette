import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

const ICONS = [
    'pixelarticons:heart',
    'pixelarticons:zap',
    'pixelarticons:shield',
    'pixelarticons:trophy',
    'pixelarticons:sun',
    'pixelarticons:moon',
    'pixelarticons:eye',
    'pixelarticons:downasaur'
];

class RouletteGame {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.msgEl = document.getElementById('msg');
        this.creditsEl = document.getElementById('credits');
        this.gridEl = document.getElementById('icon-grid');
        
        this.credits = 100;
        this.isSpinning = false;
        this.selectedIcon = null;
        this.spinStartTime = 0;
        this.spinDuration = 6000; // 6 seconds for a slower, grander spin
        this.startRotation = 0;
        this.targetSpinRotation = 0;
        this.numSegments = ICONS.length;
        this.segmentAngle = (Math.PI * 2) / this.numSegments;

        this.initThree();
        this.initUI();
        this.initSounds();
        this.animate();
        
        window.addEventListener('resize', () => this.handleResize());
    }

    initThree() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(45, this.canvas.clientWidth / this.canvas.clientHeight, 0.1, 1000);
        this.camera.position.set(0, 5, 5);
        this.camera.lookAt(0, 0, 0);

        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            antialias: true,
            alpha: true
        });
        this.renderer.setPixelRatio(window.devicePixelRatio);

        // Post-processing for Bloom
        this.composer = new EffectComposer(this.renderer);
        const renderPass = new RenderPass(this.scene, this.camera);
        this.composer.addPass(renderPass);

        this.bloomPass = new UnrealBloomPass(
            new THREE.Vector2(this.canvas.clientWidth, this.canvas.clientHeight),
            1.2,  // strength
            0.6,  // radius
            0.05  // threshold
        );
        this.composer.addPass(this.bloomPass);

        this.handleResize();

        // Schematic style: No dynamic lights, just BasicMaterials for that high-contrast look
        
        // Roulette Wheel Group
        this.wheelGroup = new THREE.Group();
        this.wheelGroup.position.x = 2.2; // Moved left to bring more into view
        this.wheelGroup.rotation.x = -0.0; // Tilted backwards more on its axis
        this.scene.add(this.wheelGroup);

        // Create dark cylinder base
        const cylinderGeo = new THREE.CylinderGeometry(3.5, 3.55, 0.6, 64);
        const cylinderMat = new THREE.MeshBasicMaterial({ color: 0x050505 });
        this.wheelBase = new THREE.Mesh(cylinderGeo, cylinderMat);
        this.wheelGroup.add(this.wheelBase);

        // Outlines for the cylinder
        const edges = new THREE.EdgesGeometry(cylinderGeo);
        const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0xd6dcdc, transparent: true, opacity: 0.9 }));
        this.wheelBase.add(line);

        // Outer white border ring
        const outerRingGeo = new THREE.TorusGeometry(3.5, 0.015, 16, 100);
        const outerRingMat = new THREE.MeshBasicMaterial({ color: 0xd6dcdc });
        const outerRing = new THREE.Mesh(outerRingGeo, outerRingMat);
        outerRing.rotation.x = Math.PI / 2;
        outerRing.position.y = 0.31;
        this.wheelBase.add(outerRing);

        // Add segment dividers and icons
        this.createWheelFace();

        // Central hub ("Axiom Core" style)
        const hubGroup = new THREE.Group();
        hubGroup.position.y = 0.35;
        this.wheelBase.add(hubGroup);

        const hubBaseGeo = new THREE.CylinderGeometry(0.9, 1, 0.2, 32);
        const hubBase = new THREE.Mesh(hubBaseGeo, new THREE.MeshBasicMaterial({ color: 0x0a0a0a }));
        hubGroup.add(hubBase);

        const hubEdge = new THREE.LineSegments(new THREE.EdgesGeometry(hubBaseGeo), new THREE.LineBasicMaterial({ color: 0xaaaaaa }));
        hubGroup.add(hubEdge);

        // Text-like ring on hub
        const hubRingGeo = new THREE.TorusGeometry(0.8, 0.01, 16, 64);
        const hubRing = new THREE.Mesh(hubRingGeo, new THREE.MeshBasicMaterial({ color: 0xaaaaaa }));
        hubRing.rotation.x = Math.PI / 2;
        hubRing.position.y = 0.11;
        hubGroup.add(hubRing);

        // User Logo in Center
        const loader = new THREE.TextureLoader();
        loader.load('/Logo.png', (texture) => {
            // Calculate aspect ratio to prevent stretching and implement "contain"
            const image = texture.image;
            const aspect = image.width / image.height;
            const targetSize = 0.45; // The maximum dimension the logo should take
            
            let width, height;
            if (aspect > 1) {
                width = targetSize;
                height = targetSize / aspect;
            } else {
                width = targetSize * aspect;
                height = targetSize;
            }

            const logoGeo = new THREE.PlaneGeometry(width, height);
            const logoMat = new THREE.MeshBasicMaterial({ 
                map: texture,
                transparent: true,
                side: THREE.DoubleSide,
                // Ensure no artifacts from depth testing with transparency
                depthWrite: false
            });
            const logoMesh = new THREE.Mesh(logoGeo, logoMat);
            logoMesh.rotation.x = -Math.PI / 2;
            logoMesh.position.y = 0.12; 
            hubGroup.add(logoMesh);
        });

        // Selection Highlight Wedge (Invisible initially)
        // We start theta at -segmentAngle/2 so rotating it to 'angle' centers it
        const wedgeGeo = new THREE.RingGeometry(1, 3.5, 32, 1, -this.segmentAngle / 2, this.segmentAngle);
        const wedgeMat = new THREE.MeshBasicMaterial({ 
            color: 0xff4a00, 
            transparent: true, 
            opacity: 0, 
            side: THREE.DoubleSide 
        });
        this.selectionWedge = new THREE.Mesh(wedgeGeo, wedgeMat);
        this.selectionWedge.rotation.x = -Math.PI / 2;
        this.selectionWedge.position.y = 0.305;
        this.wheelBase.add(this.selectionWedge);

        // Pointer/Beam - Now positioned on the left side of the wheel's face
        this.pointerGroup = new THREE.Group();
        this.pointerGroup.position.set(0.1, 0.8, 0); // Adjusted to match new wheel position and tilt
        this.scene.add(this.pointerGroup);

        // Glowing ball/token at the pointer
        const pointerBallGeo = new THREE.CylinderGeometry(0.15, 0.15, 0.05, 24);
        const pointerBallMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
        this.pointerBall = new THREE.Mesh(pointerBallGeo, pointerBallMat);
        this.pointerGroup.add(this.pointerBall);

        const ballEdge = new THREE.LineSegments(new THREE.EdgesGeometry(pointerBallGeo), new THREE.LineBasicMaterial({ color: 0xff4a00 }));
        this.pointerBall.add(ballEdge);

        // Vertical Beam
        const beamGeo = new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(0, 10, 0)
        ]);
        const beamMat = new THREE.LineBasicMaterial({ color: 0xff4a00, transparent: true, opacity: 1 });
        this.beamLine = new THREE.Line(beamGeo, beamMat);
        this.pointerGroup.add(this.beamLine);
    }

    createWheelFace() {
        const iconSize = 256;
        
        // Create structural elements immediately
        for (let i = 0; i < this.numSegments; i++) {
            // Draw white segment dividers
            const lineGeo = new THREE.BufferGeometry().setFromPoints([
                new THREE.Vector3(0, 0, 0),
                new THREE.Vector3(0, 0, -3.5)
            ]);
            const lineMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 });
            const line = new THREE.Line(lineGeo, lineMat);
            line.rotation.y = i * this.segmentAngle;
            line.position.y = 0.31;
            this.wheelBase.add(line);
        }

        // Inner decorative circle
        const innerCircleGeo = new THREE.TorusGeometry(1.5, 0.005, 16, 100);
        const innerCircle = new THREE.Mesh(innerCircleGeo, new THREE.MeshBasicMaterial({ color: 0x555555 }));
        innerCircle.rotation.x = Math.PI / 2;
        innerCircle.position.y = 0.31;
        this.wheelBase.add(innerCircle);

        // Load icons in parallel
        ICONS.forEach(async (iconName, i) => {
            try {
                const iconTex = await this.createIconTexture(iconName, iconSize);
                const iconGeo = new THREE.PlaneGeometry(1.0, 1.0);
                const iconMat = new THREE.MeshBasicMaterial({ 
                    map: iconTex, 
                    transparent: true,
                    color: 0xd6dcdc,
                    depthWrite: false,
                    side: THREE.DoubleSide
                });
                const iconMesh = new THREE.Mesh(iconGeo, iconMat);
                
                const radius = 2.2;
                const angle = i * this.segmentAngle + this.segmentAngle / 2;
                iconMesh.position.set(
                    Math.sin(angle) * radius,
                    0.32,
                    -Math.cos(angle) * radius
                );
                iconMesh.rotation.x = -Math.PI / 2;
                iconMesh.rotation.z = -angle;
                this.wheelBase.add(iconMesh);
            } catch (err) {
                console.warn(`Failed to load icon ${iconName}`, err);
            }
        });
    }

    async createIconTexture(iconName, size) {
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        
        try {
            const response = await fetch(`https://api.iconify.design/${iconName.replace(':', '/')}.svg`);
            if (!response.ok) throw new Error(`Status ${response.status}`);
            const svgText = await response.text();
            const blob = new Blob([svgText], { type: 'image/svg+xml' });
            const url = URL.createObjectURL(blob);
            
            return new Promise((resolve, reject) => {
                const img = new Image();
                img.crossOrigin = "Anonymous";
                img.onload = () => {
                    ctx.drawImage(img, 0, 0, size, size);
                    
                    // Force white color
                    ctx.globalCompositeOperation = 'source-in';
                    ctx.fillStyle = '#FFFFFF';
                    ctx.fillRect(0, 0, size, size);

                    const texture = new THREE.CanvasTexture(canvas);
                    texture.minFilter = THREE.NearestFilter;
                    texture.magFilter = THREE.NearestFilter;
                    
                    URL.revokeObjectURL(url);
                    resolve(texture);
                };
                img.onerror = () => {
                    URL.revokeObjectURL(url);
                    reject(new Error("Image load failed"));
                };
                img.src = url;
            });
        } catch (e) {
            // Fallback for failed icons
            console.warn("Icon load error, using fallback:", iconName);
            ctx.fillStyle = '#D6DCDC';
            ctx.font = 'bold 150px monospace';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('?', size/2, size/2);
            return new THREE.CanvasTexture(canvas);
        }
    }

    initUI() {
        ICONS.forEach((icon, index) => {
            const btn = document.createElement('button');
            btn.className = 'bet-btn';
            btn.innerHTML = `<span class="iconify" data-icon="${icon}"></span>`;
            btn.onclick = () => this.selectBet(index);
            this.gridEl.appendChild(btn);
        });
    }

    selectBet(index) {
        if (this.isSpinning) return;
        this.playSound('click');
        
        this.selectedIcon = index;
        const buttons = document.querySelectorAll('.bet-btn');
        buttons.forEach((b, i) => {
            if (i === index) b.classList.add('selected');
            else b.classList.remove('selected');
        });

        this.spin();
    }

    spin() {
        if (this.isSpinning || this.credits < 10) return;
        
        this.credits -= 10;
        this.updateCredits();
        this.isSpinning = true;
        this.msgEl.innerText = "SPINNING...";
        
        // Reset selection wedge
        this.selectionWedge.material.opacity = 0;
        
        // Random outcome
        this.winIndex = Math.floor(Math.random() * this.numSegments);
        
        const iconAngle = (this.winIndex * this.segmentAngle + this.segmentAngle / 2);
        const targetWheelRotation = iconAngle + Math.PI / 2;
        
        const currentRot = this.wheelGroup.rotation.y;
        // Increased number of rotations for a longer feel since it's slower
        const minRotation = currentRot + Math.PI * 2 * (6 + Math.random() * 2);
        
        let finalRotation = targetWheelRotation;
        while (finalRotation < minRotation) {
            finalRotation += Math.PI * 2;
        }
        
        this.startRotation = currentRot;
        this.targetSpinRotation = finalRotation;
        this.spinStartTime = performance.now();
        this.lastTickSegment = Math.floor(currentRot / this.segmentAngle);
    }

    updateCredits() {
        this.creditsEl.innerText = `CREDITS: ${this.credits}`;
    }

    initSounds() {
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        this.sounds = {};
        const loadSound = async (name, url) => {
            try {
                const response = await fetch(url);
                const arrayBuffer = await response.arrayBuffer();
                this.sounds[name] = await this.audioCtx.decodeAudioData(arrayBuffer);
            } catch (e) {
                console.error("Audio error", e);
            }
        };

        loadSound('click', 'click.mp3');
        loadSound('tick', 'spin_tick.mp3');
        loadSound('score', 'score.mp3');
        loadSound('fail', 'fail.mp3');
    }

    playSound(name) {
        if (!this.sounds[name]) return;
        if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
        const source = this.audioCtx.createBufferSource();
        source.buffer = this.sounds[name];
        source.connect(this.audioCtx.destination);
        source.start(0);
    }

    handleResize() {
        const container = document.getElementById('canvas-container');
        const width = container.clientWidth;
        const height = container.clientHeight;
        this.renderer.setSize(width, height);
        this.composer.setSize(width, height);
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
    }

    // Cubic Bezier Ease Out function
    easeOutCubic(t) {
        return 1 - Math.pow(1 - t, 3);
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        if (this.isSpinning) {
            const now = performance.now();
            const elapsed = now - this.spinStartTime;
            let t = Math.min(elapsed / this.spinDuration, 1);
            
            // Apply easing for a smooth "Bezier" style stop
            const easedT = this.easeOutCubic(t);
            
            const prevRotation = this.wheelGroup.rotation.y;
            this.wheelGroup.rotation.y = this.startRotation + (this.targetSpinRotation - this.startRotation) * easedT;
            
            // Play tick sound when passing segments
            const currentSeg = Math.floor(this.wheelGroup.rotation.y / this.segmentAngle);
            if (currentSeg !== this.lastTickSegment) {
                this.playSound('tick');
                this.lastTickSegment = currentSeg;
            }

            if (t >= 1) {
                this.wheelGroup.rotation.y = this.targetSpinRotation;
                this.finishSpin();
            }
        } else {
            // Idle subtle movement
            this.wheelGroup.rotation.y += 0.001;
        }

        this.composer.render();
    }

    finishSpin() {
        this.isSpinning = false;
        
        // Highlight winning segment
        // Icon angle is alpha. Polar angle for RingGeometry (+X origin) is alpha - PI/2
        const iconAngle = (this.winIndex * this.segmentAngle + this.segmentAngle / 2);
        this.selectionWedge.rotation.z = -(iconAngle - Math.PI / 2);
        this.selectionWedge.material.opacity = 0.2;

        if (this.selectedIcon === this.winIndex) {
            this.credits += 80;
            this.msgEl.innerText = "MATCH! +80 CREDITS";
            this.selectionWedge.material.color.set(0xccccff);
            this.selectionWedge.material.opacity = 1;
            this.playSound('score');
        } else {
            this.msgEl.innerText = "NO MATCH. TRY AGAIN.";
            this.selectionWedge.material.color.set(0xff4a00);
          this.selectionWedge.material.opacity = 1;
            this.playSound('fail');
        }
        
        this.updateCredits();
        if (this.credits < 10) {
            this.msgEl.innerText = "OUT OF CREDITS. RESETTING...";
            setTimeout(() => {
                this.credits = 100;
                this.updateCredits();
            }, 2000);
        }
    }
}

window.addEventListener('load', () => {
    new RouletteGame();
});