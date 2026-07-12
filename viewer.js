import * as pdfjs from './pdf.mjs';

pdfjs.GlobalWorkerOptions.workerSrc = './pdf.worker.mjs';

const queryString = window.location.search;
const params = new URLSearchParams(queryString);


const pdfURL = params.get('pdf');

async function loadPDF() {
    try {
        const load = pdfjs.getDocument({ url: pdfURL });
        const pdfDocument = await load.promise;

        return pdfDocument;
    } catch(error) {
        console.log("Error loading page: " + error)
    }
};

const pdfDocument = await loadPDF();
const page = await loadTargetPage(pdfDocument, 1);


async function loadTargetPage(pdfDocument, num) {
    try {
        const page = await pdfDocument.getPage(num);

        console.log(`successfully loaded page ${num}`, page);
        return page;
    } catch(error) {
        console.log("Error loading page: " + error)
    }
};


const viewport = page.getViewport({ scale: 1 });

const canElement = document.getElementById('pdf');
const conElement = document.getElementById('container');
const ctx = canElement.getContext('2d')

canElement.width = viewport.width;
canElement.height = viewport.height;
conElement.style.width = viewport.width + 'px';
conElement.style.height = viewport.height + 'px';

const pageRender = await page.render({ canvasContext: ctx, viewport: viewport}).promise;

const textContent = await page.getTextContent();
console.log(textContent);

let textArray = [];

for( let i = 0; i < textContent.items.length; i++) {
    let item = { 
        str: textContent.items[i].str,
        x: textContent.items[i].transform[4],
        y: textContent.items[i].transform[5],
        width: textContent.items[i].width,
        height: textContent.items[i].height,
        hasEOL: textContent.items[i].hasEOL
    };
    textArray.push(item);
}


let text = '';
let charSourceMap = [];
let itemStartIndex = [];


for(let i = 0; i < textContent.items.length; i++) {
    itemStartIndex.push(text.length);
    let str = textContent.items[i].str;
    for(let k = 0; k < str.length; k++) {
        charSourceMap.push(i);
    }
    text += str;
    if (textContent.items[i].hasEOL == true) {
        charSourceMap.push(i);
        text += "\n";
    }
}

let sentence = text.matchAll(/[^.!?\n]+[.!?]+|[^.!?\n]+\n/g);
let sentenceArray = Array.from(sentence);
let cleanSentence = sentenceArray.map(function(s) {
    let endIndex = s.index + s[0].length;
    let clean = s[0].replace(/\n/g, ' ').trim();
    let charIndicies = charSourceMap.slice(s.index, endIndex);
    let charItemIndicies = [...new Set(charIndicies)];
    let itemStart = itemStartIndex[charItemIndicies[0]];
    let sentenceStartItem = s.index - itemStart;
    let sentenceEndItem = endIndex - itemStart;
    let position;
    if (charItemIndicies.length === 1) {
        let item = textArray[charItemIndicies[0]];
        let xO = (sentenceStartItem / item.str.length) * item.width;
        let widthO = ((sentenceEndItem - sentenceStartItem) / item.str.length) * item.width;
        position = { x: item.x + xO, y: item.y, width: widthO, height: item.height};
    } else if(charItemIndicies.length > 1) {
        let itemIndiciesMap = charItemIndicies.map(function(idx) {
            return textArray[idx];
        });
        let xs = itemIndiciesMap.map(function(it) {
            return it.x;
        });
        let xWidth = itemIndiciesMap.map(function(it) {
            return it.x + it.width;
        });
        let ys = itemIndiciesMap.map(function(it) {
            return it.y;
        });
        let yHeight = itemIndiciesMap.map(function(it) {
            return it.y + it.height;
        });
        let minX = Math.min(...xs);
        let maxXEnd = Math.max(...xWidth);
        let minY = Math.min(...ys);
        let maxYEnd = Math.max(...yHeight);
        position = { x: minX, y: minY, width: maxXEnd - minX, height: maxYEnd - minY};
    }
    return { text: clean, startIndex: s.index, endIndex: endIndex, itemIndicies: charItemIndicies, pos: position};
});


console.log(cleanSentence);
let activeIndex = 0;

function createHighlightBox(x, y, width, height) {
    let topLeft = viewport.convertToViewportPoint(x, y);
    let bottomRight = viewport.convertToViewportPoint(x + width, y + height);
    let left = Math.min(topLeft[0], bottomRight[0]);
    let top = Math.min(topLeft[1], bottomRight[1]);
    let boxWidth = Math.abs(bottomRight[0] - topLeft[0]);
    let boxHeight = Math.abs(bottomRight[1] - topLeft[1]);

    let box = document.createElement('div');
    box.style.position = 'absolute';
    box.style.left = left + 'px';
    box.style.top = top + 'px';
    box.style.width = boxWidth + 'px';
    box.style.height = boxHeight + 'px';
    box.style.backgroundColor = 'rgba(255, 255, 0, 0.4)';
    box.style.pointerEvents = 'none';

    conElement.appendChild(box);
    return box;
}

function highlight() {
    let getSentence = cleanSentence[activeIndex];
    conElement.innerHTML = '';
    let firstBox = null;

    if (getSentence.itemIndicies.length === 1) {
        let pos = getSentence.pos;
        let box = createHighlightBox(pos.x, pos.y, pos.width, pos.height);
        firstBox = box;
    } else {
        for (let i = 0; i < getSentence.itemIndicies.length; i++) {
            let item = textArray[getSentence.itemIndicies[i]];
            let box = createHighlightBox(item.x, item.y, item.width, item.height);
            if (i === 0) {
                firstBox = box;
            }
        }
    }

    if (firstBox) {
        firstBox.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

function handleNavigation(event) {
    if(event.key == 'Tab') {
        event.preventDefault();
        let direction = event.shiftKey ? -1 : 1;
        activeIndex += direction;
        if(activeIndex < 0) {
            activeIndex = 0;
        } else if(activeIndex > cleanSentence.length -1) {
            activeIndex = cleanSentence.length -1;
        }
        console.log(activeIndex, cleanSentence[activeIndex]);
        highlight();
    }
}

document.addEventListener('keydown', handleNavigation);
highlight();





