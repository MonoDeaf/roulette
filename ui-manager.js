import { ICONS, CUSTOM_ICONS } from './constants.js';

export class UIManager {
    constructor(onBetSelect) {
        this.creditsEl = document.getElementById('credits');
        this.gridEl = document.getElementById('icon-grid');
        this.msgEl = document.getElementById('msg');
        this.onBetSelect = onBetSelect;
        this.initButtons();
    }

    initButtons() {
        ICONS.forEach((icon, index) => {
            const btn = document.createElement('button');
            btn.className = 'bet-btn';
            if (CUSTOM_ICONS[icon]) {
                const svg = CUSTOM_ICONS[icon].replace("fill='%23000'", "fill='currentColor'");
                btn.innerHTML = svg;
                const svgEl = btn.querySelector('svg');
                if (svgEl) {
                    svgEl.style.width = '24px';
                    svgEl.style.height = '24px';
                }
            } else {
                btn.innerHTML = `<span class="iconify" data-icon="${icon}"></span>`;
            }
            btn.onclick = () => this.onBetSelect(index);
            this.gridEl.appendChild(btn);
        });
    }

    updateCredits(credits) {
        this.creditsEl.innerText = `CREDITS: ${credits}`;
    }

    setMessage(text) {
        this.msgEl.innerText = text;
    }

    setSelected(index) {
        const buttons = document.querySelectorAll('.bet-btn');
        buttons.forEach((b, i) => {
            if (i === index) b.classList.add('selected');
            else b.classList.remove('selected');
        });
    }

    setDisabled(disabled) {
        const buttons = document.querySelectorAll('.bet-btn');
        buttons.forEach(b => b.disabled = disabled);
    }
}