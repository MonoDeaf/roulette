export class AudioManager {
    constructor() {
        this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        this.sounds = {};
    }

    async init() {
        const loadSound = async (name, url) => {
            try {
                const response = await fetch(url);
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                const arrayBuffer = await response.arrayBuffer();
                this.sounds[name] = await this.audioCtx.decodeAudioData(arrayBuffer);
            } catch (e) {
                console.error(`Audio error loading ${name}:`, e);
            }
        };

        await Promise.all([
            loadSound('click', 'click.mp3'),
            loadSound('tick', 'spin_tick.mp3'),
            loadSound('score', 'score.mp3'),
            loadSound('fail', 'fail.mp3')
        ]);
    }

    play(name) {
        if (!this.sounds[name]) return;
        if (this.audioCtx.state === 'suspended') this.audioCtx.resume();
        const source = this.audioCtx.createBufferSource();
        source.buffer = this.sounds[name];
        source.connect(this.audioCtx.destination);
        source.start(0);
    }
}