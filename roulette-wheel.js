import * as THREE from 'three';
import { ICONS, CUSTOM_ICONS, COLORS } from './constants.js';

export class RouletteWheel {
    constructor(numSegments) {
        this.numSegments = numSegments;
        this.segmentAngle = (Math.PI * 2) / numSegments;
        this.group = new THREE.Group();
        this.group.position.x = 2.2;
        
        this.init();
    }

    init() {
        // Create dark cylinder base
        const cylinderGeo = new THREE.CylinderGeometry(3.5, 3.55, 0.6, 64);
        const cylinderMat = new THREE.MeshStandardMaterial({ 
            color: 0x111111,
            metalness: 0.8,
            roughness: 0.3
        });
        this.base = new THREE.Mesh(cylinderGeo, cylinderMat);
        this.group.add(this.base);

        // Outlines
        const edges = new THREE.EdgesGeometry(cylinderGeo);
        const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ 
            color: COLORS.border, 
            transparent: true, 
            opacity: 0.9 
        }));
        this.base.add(line);

        // Outer ring
        const outerRingGeo = new THREE.TorusGeometry(3.5, 0.015, 16, 100);
        const outerRing = new THREE.Mesh(outerRingGeo, new THREE.MeshBasicMaterial({ color: COLORS.border }));
        outerRing.rotation.x = Math.PI / 2;
        outerRing.position.y = 0.31;
        this.base.add(outerRing);

        this.createFace();
        this.createHub();
        this.createSelectionVisuals();
    }

    createHub() {
        const hubGroup = new THREE.Group();
        hubGroup.position.y = 0.35;
        this.base.add(hubGroup);

        const hubBaseGeo = new THREE.CylinderGeometry(0.9, 0.9, 0.2, 32);
        const hubBase = new THREE.Mesh(hubBaseGeo, new THREE.MeshStandardMaterial({ 
            color: COLORS.background,
            metalness: 0.6,
            roughness: 0.4
        }));
        hubGroup.add(hubBase);

        const hubEdge = new THREE.LineSegments(new THREE.EdgesGeometry(hubBaseGeo), new THREE.LineBasicMaterial({ color: COLORS.border }));
        hubGroup.add(hubEdge);

        const hubRingGeo = new THREE.TorusGeometry(0.8, 0.01, 16, 64);
        const hubRing = new THREE.Mesh(hubRingGeo, new THREE.MeshBasicMaterial({ color: COLORS.border }));
        hubRing.rotation.x = Math.PI / 2;
        hubRing.position.y = 0.11;
        hubGroup.add(hubRing);

        const loader = new THREE.TextureLoader();
        loader.load('Logo.png', (texture) => {
            const aspect = texture.image.width / texture.image.height;
            const targetSize = 0.9;
            let w = targetSize, h = targetSize;
            if (aspect > 1) h = targetSize / aspect; else w = targetSize * aspect;
            
            const logoGeo = new THREE.PlaneGeometry(w, h);
            const logoMat = new THREE.MeshBasicMaterial({ 
                map: texture, 
                transparent: true, 
                depthWrite: false, 
                side: THREE.DoubleSide,
                opacity: 0.1
            });
            const logoMesh = new THREE.Mesh(logoGeo, logoMat);
            logoMesh.rotation.x = -Math.PI / 2;
            logoMesh.position.y = 0.12;
            hubGroup.add(logoMesh);
        });
    }

    createSelectionVisuals() {
        // Wedge
        const wedgeGeo = new THREE.RingGeometry(1, 3.5, 32, 1, -this.segmentAngle / 2, this.segmentAngle);
        this.selectionWedge = new THREE.Mesh(wedgeGeo, new THREE.MeshBasicMaterial({ 
            color: COLORS.lose, 
            transparent: true, 
            opacity: 0, 
            side: THREE.DoubleSide,
            depthWrite: false
        }));
        this.selectionWedge.rotation.x = -Math.PI / 2;
        this.selectionWedge.position.y = 0.312;
        this.base.add(this.selectionWedge);

        // Bold Border
        this.selectionBorder = new THREE.Group();
        const thickness = 0.15, innerR = 1.0, outerR = 3.5, halfAngle = this.segmentAngle / 2;
        const mat = new THREE.MeshBasicMaterial({ color: COLORS.lose, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false });

        const innerArc = new THREE.Mesh(new THREE.RingGeometry(innerR, innerR + thickness, 32, 1, -halfAngle, this.segmentAngle), mat);
        const outerArc = new THREE.Mesh(new THREE.RingGeometry(outerR - thickness, outerR, 32, 1, -halfAngle, this.segmentAngle), mat);
        
        const sideLen = outerR - innerR;
        const midR = (innerR + outerR) / 2;
        const sideGeo = new THREE.PlaneGeometry(sideLen, thickness);
        
        const leftSide = new THREE.Mesh(sideGeo, mat);
        leftSide.rotation.z = -halfAngle;
        leftSide.position.set(Math.cos(-halfAngle) * midR, Math.sin(-halfAngle) * midR, 0);
        
        const rightSide = new THREE.Mesh(sideGeo, mat);
        rightSide.rotation.z = halfAngle;
        rightSide.position.set(Math.cos(halfAngle) * midR, Math.sin(halfAngle) * midR, 0);

        this.selectionBorder.add(innerArc, outerArc, leftSide, rightSide);
        this.selectionBorder.rotation.x = -Math.PI / 2;
        this.selectionBorder.position.y = 0.313;
        this.base.add(this.selectionBorder);
    }

    createFace() {
        for (let i = 0; i < this.numSegments; i++) {
            const lineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -3.5)]);
            const line = new THREE.Line(lineGeo, new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 }));
            line.rotation.y = i * this.segmentAngle;
            line.position.y = 0.31;
            this.base.add(line);
        }

        const innerCircle = new THREE.Mesh(new THREE.TorusGeometry(1.5, 0.005, 16, 100), new THREE.MeshBasicMaterial({ color: COLORS.border }));
        innerCircle.rotation.x = Math.PI / 2;
        innerCircle.position.y = 0.31;
        this.base.add(innerCircle);

        ICONS.forEach(async (icon, i) => {
            const tex = await this.createIconTexture(icon, 256);
            const mesh = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: tex, transparent: true, color: 0xcccccc, depthWrite: false, side: THREE.DoubleSide }));
            const angle = i * this.segmentAngle + this.segmentAngle / 2;
            mesh.position.set(Math.sin(angle) * 2.2, 0.32, -Math.cos(angle) * 2.2);
            mesh.rotation.x = -Math.PI / 2;
            mesh.rotation.z = -angle;
            this.base.add(mesh);
        });
    }

    async createIconTexture(iconName, size) {
        const canvas = document.createElement('canvas');
        canvas.width = size; canvas.height = size;
        const ctx = canvas.getContext('2d');
        try {
            let url;
            if (CUSTOM_ICONS[iconName]) {
                url = URL.createObjectURL(new Blob([CUSTOM_ICONS[iconName]], { type: 'image/svg+xml' }));
            } else {
                const res = await fetch(`https://api.iconify.design/${iconName.replace(':', '/')}.svg`);
                url = URL.createObjectURL(new Blob([await res.text()], { type: 'image/svg+xml' }));
            }
            return new Promise(resolve => {
                const img = new Image();
                img.crossOrigin = "Anonymous";
                img.onload = () => {
                    ctx.drawImage(img, 0, 0, size, size);
                    ctx.globalCompositeOperation = 'source-in';
                    ctx.fillStyle = '#FFFFFF';
                    ctx.fillRect(0, 0, size, size);
                    const tex = new THREE.CanvasTexture(canvas);
                    tex.minFilter = tex.magFilter = THREE.NearestFilter;
                    URL.revokeObjectURL(url);
                    resolve(tex);
                };
                img.src = url;
            });
        } catch (e) {
            ctx.fillStyle = '#cccccc'; ctx.font = 'bold 150px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText('?', size/2, size/2);
            return new THREE.CanvasTexture(canvas);
        }
    }

    showResult(winIndex, isWin) {
        const iconAngle = (winIndex * this.segmentAngle + this.segmentAngle / 2);
        const rotationZ = -(iconAngle - Math.PI / 2);
        this.selectionWedge.rotation.z = rotationZ;
        this.selectionBorder.rotation.z = rotationZ;

        const color = isWin ? COLORS.win : COLORS.lose;
        this.selectionWedge.material.color.set(color);
        this.selectionWedge.material.opacity = 0.25;
        this.selectionBorder.children.forEach(c => {
            c.material.color.set(color);
            c.material.opacity = 1;
        });
    }

    resetHighlight() {
        this.selectionWedge.material.opacity = 0;
        this.selectionBorder.children.forEach(c => c.material.opacity = 0);
    }
}