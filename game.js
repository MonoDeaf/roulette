function isRunningAsApp() {
return window.matchMedia('(display-mode: standalone)').matches 
|| window.navigator.standalone === true;
}

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { Line2 } from 'three/addons/lines/Line2.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';

import { ICONS, LIGHTING } from './constants.js';
import { AudioManager } from './audio-manager.js';
import { UIManager } from './ui-manager.js';
import { RouletteWheel } from './roulette-wheel.js';

// removed CUSTOM_ICONS and ICONS constants
// moved to constants.js

class RouletteGame {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.credits = 100;
        this.isSpinning = false;
        this.selectedIcon = null;
        this.spinStartTime = 0;
        this.spinDuration = 6000;
        this.startRotation = 0;
        this.targetSpinRotation = 0;
        this.numSegments = ICONS.length;

        this.audio = new AudioManager();
        this.ui = new UIManager((idx) => this.selectBet(idx));
        this.wheel = new RouletteWheel(this.numSegments);

        this.initThree();
        this.audio.init();
        this.animate();
        
        window.addEventListener('resize', () => this.handleResize());
    }

    initThree() {
        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(45, this.canvas.clientWidth / this.canvas.clientHeight, 0.1, 1000);
        this.camera.position.set(0, 5, 5);
        this.camera.lookAt(0, 0, 0);

        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, alpha: true });
        this.renderer.setPixelRatio(window.devicePixelRatio);

        this.composer = new EffectComposer(this.renderer);
        this.composer.addPass(new RenderPass(this.scene, this.camera));
        this.bloomPass = new UnrealBloomPass(new THREE.Vector2(this.canvas.clientWidth, this.canvas.clientHeight), 1.5, 0.75, 0.25);
        this.composer.addPass(this.bloomPass);

        this.handleResize();

        this.scene.add(this.wheel.group);

        // Lighting
        this.ambientLight = new THREE.AmbientLight(
            LIGHTING.ambientColor, 
            LIGHTING.ambientIntensity
        );
        this.scene.add(this.ambientLight);

        this.pointLight = new THREE.PointLight(
            LIGHTING.pointColor, 
            LIGHTING.pointIntensity
        );
        this.pointLight.position.set(
            LIGHTING.pointPosition.x, 
            LIGHTING.pointPosition.y, 
            LIGHTING.pointPosition.z
        );
        this.scene.add(this.pointLight);

        // Pointer Setup
        this.pointerGroup = new THREE.Group();
        this.pointerGroup.position.set(-0.5, 0.75, 0);
        this.scene.add(this.pointerGroup);

        const coneGeo = new THREE.ConeGeometry(0.25, 0.6, 8);
        const cone = new THREE.Mesh(coneGeo, new THREE.MeshStandardMaterial({ 
            color: 0xff4a00, 
            transparent: true, 
            opacity: 0.25,
            metalness: 0.5,
            roughness: 0.2
        }));
        cone.rotation.x = Math.PI; // Point down
        this.pointerGroup.add(cone);

        this.lineMaterials = [];

        // Create 2px border for the cone shape
        const edges = new THREE.EdgesGeometry(coneGeo);
        const coneOutlineGeo = new LineSegmentsGeometry().fromEdgesGeometry(edges);
        const coneOutlineMat = new LineMaterial({ 
            color: 0xff4a00, 
            linewidth: 1, 
            resolution: new THREE.Vector2(this.canvas.clientWidth, this.canvas.clientHeight) 
        });
        this.lineMaterials.push(coneOutlineMat);
        const coneOutline = new LineSegments2(coneOutlineGeo, coneOutlineMat);
        cone.add(coneOutline);
    }

    // removed createSelectionBorder() {}
    // removed createWheelFace() {}
    // removed createIconTexture() {}
    // removed initUI() {}

    selectBet(index) {
        if (this.isSpinning) return;
        this.audio.play('click');
        this.selectedIcon = index;
        this.ui.setSelected(index);
        this.spin();
    }

    spin() {
        if (this.isSpinning || this.credits < 10) return;
        
        this.credits -= 10;
        this.ui.updateCredits(this.credits);
        this.isSpinning = true;
        this.ui.setMessage("SPINNING...");
        this.wheel.resetHighlight();
        
        this.winIndex = Math.floor(Math.random() * this.numSegments);
        const targetWheelRotation = (this.winIndex * this.wheel.segmentAngle + this.wheel.segmentAngle / 2) + Math.PI / 2;
        
        const currentRot = this.wheel.group.rotation.y;
        const minRotation = currentRot + Math.PI * 2 * (6 + Math.random() * 2);
        
        let finalRotation = targetWheelRotation;
        while (finalRotation < minRotation) finalRotation += Math.PI * 2;
        
        this.startRotation = currentRot;
        this.targetSpinRotation = finalRotation;
        this.spinStartTime = performance.now();
        this.lastTickSegment = Math.floor(currentRot / this.wheel.segmentAngle);
    }

    // removed updateCredits() {}
    // removed initSounds() {}
    // removed playSound() {}

    handleResize() {
        const width = this.canvas.parentElement.clientWidth;
        const height = this.canvas.parentElement.clientHeight;
        this.renderer.setSize(width, height);
        this.composer.setSize(width, height);
        this.camera.aspect = width / height;
        this.camera.updateProjectionMatrix();
        
        if (this.lineMaterials) {
            this.lineMaterials.forEach(mat => {
                mat.resolution.set(width, height);
            });
        }
    }

    easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

    animate() {
        requestAnimationFrame(() => this.animate());
        if (this.isSpinning) {
            const t = Math.min((performance.now() - this.spinStartTime) / this.spinDuration, 1);
            const easedT = this.easeOutCubic(t);
            this.wheel.group.rotation.y = this.startRotation + (this.targetSpinRotation - this.startRotation) * easedT;
            
            const currentSeg = Math.floor(this.wheel.group.rotation.y / this.wheel.segmentAngle);
            if (currentSeg !== this.lastTickSegment) {
                this.audio.play('tick');
                this.lastTickSegment = currentSeg;
            }
            if (t >= 1) {
                this.wheel.group.rotation.y = this.targetSpinRotation;
                this.finishSpin();
            }
        } else {
            this.wheel.group.rotation.y += 0.001;
        }
        this.composer.render();
    }

    finishSpin() {
        this.isSpinning = false;
        const isWin = this.selectedIcon === this.winIndex;
        this.wheel.showResult(this.winIndex, isWin);

        if (isWin) {
            this.credits += 80;
            this.ui.setMessage("MATCH! +80 CREDITS");
            this.audio.play('score');
        } else {
            this.ui.setMessage("NO MATCH. TRY AGAIN.");
            this.audio.play('fail');
        }
        
        this.ui.updateCredits(this.credits);
        if (this.credits < 10) {
            this.ui.setMessage("OUT OF CREDITS. RESETTING...");
            setTimeout(() => {
                this.credits = 100;
                this.ui.updateCredits(this.credits);
            }, 2000);
        }
    }
}

window.addEventListener('load', () => new RouletteGame());
