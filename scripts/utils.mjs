/*
▓█████▄  ██▀███           ▒█████  
▒██▀ ██▌▓██ ▒ ██▒        ▒██▒  ██▒
░██   █▌▓██ ░▄█ ▒        ▒██░  ██▒
░▓█▄   ▌▒██▀▀█▄          ▒██   ██░
░▒████▓ ░██▓ ▒██▒ ██▓    ░ ████▓▒░
 ▒▒▓  ▒ ░ ▒▓ ░▒▓░ ▒▓▒    ░ ▒░▒░▒░ 
 ░ ▒  ▒   ░▒ ░ ▒░ ░▒       ░ ▒ ▒░ 
 ░ ░  ░   ░░   ░  ░      ░ ░ ░ ▒  
   ░       ░       ░         ░ ░  
 ░                 ░              
 */


/**
 * 
 * @param {*} value prepended value
 * @param {Array} array 
 * @returns {Array} new array with value prepended
 */
export function prepend(value, array) {
    var newArray = array.slice();
    newArray.unshift(value);
    return newArray;
}

export function vNeg(p){ // Return -1*v
    return {x:-p.x, y:-p.y};
}
export function vAdd(p1, p2){ // Return the sum, p1 + p2
    return {x:p1.x+p2.x, y:p1.y+p2.y };
}
export function vSub(p1, p2){// Return the difference, p1-p2
    return {x:p1.x-p2.x, y:p1.y-p2.y };
}
export function vMult(p,v){ // Multiply vector p with value v
    return {x:p.x*v, y: p.y*v};  
}
export function vDot(p1, p2){ // Return the dot product of p1 and p2
    return p1.x*p2.x + p1.y*p2.y;
}
export function vLen(p){ // Return the length of the vector p
    return Math.sqrt(p.x**2 + p.y**2);
}
export function vNorm(p){ // Normalize the vector p, p/||p||
    return vMult(p, 1.0/vLen(p));
}
export function vAngle(p){ // The foundry compatible 'rotation angle' to point along the vector p
    return 90+Math.toDegrees(Math.atan2(p.y, p.x));
}



export class Vec2 {
    constructor(x, y) {
        this.x = x != null ? x : 0;
        this.y = y != null ? y : 0;
    }
    set(x, y) {
        this.x = x;
        this.y = y;
        return this;
    }
    setVec2(v) {
        this.x = v.x;
        this.y = v.y;
        return this;
    }
    equals(v, tolerance) {
        if (tolerance == null) {
            tolerance = 0.0000001;
        }
        return (Math.abs(v.x - this.x) <= tolerance) && (Math.abs(v.y - this.y) <= tolerance);
    }
    add(v) {
        this.x += v.x;
        this.y += v.y;
        return this;
    }
    added(v) {
        return Vec2.create( this.x + v.x, this.y + v.y);        
    }
    sub(v) {
        this.x -= v.x;
        this.y -= v.y;
        return this;
    }
    subbed(v) {
        return Vec2.create( this.x - v.x, this.y - v.y);        
    }
    scale(f) {
        this.x *= f;
        this.y *= f;
        return this;
    }
    scaled(f) {
        return Vec2.create( this.x * f, this.y * f );
    }
    distance(v) {
        var dx = v.x - this.x;
        var dy = v.y - this.y;
        return Math.sqrt(dx * dx + dy * dy);
    }
    squareDistance(v) {
        var dx = v.x - this.x;
        var dy = v.y - this.y;
        return dx * dx + dy * dy;
    }
    copy(v) {
        this.x = v.x;
        this.y = v.y;
        return this;
    }
    clone() {
        return new Vec2(this.x, this.y);
    }
    dup(){
        return this.clone();
    }
    dot(b) {
        return this.x * b.x + this.y * b.y;
    }
    normalize() {
        var len = this.length();
        if (len > 0) {
            this.scale(1 / len);
        }
        return this;
    }
    static create(x, y) {
        return new Vec2(x, y);
    }
    static fromArray(a) {
        return new Vec2(a[0], a[1]);
    }
}


/**
 * @param {Array} arr1 Array to reorder
 * @param {Array} arr2 Array to sort, and used as indices for re-order array
 * @returns {Array} Array 1 sorted by array 2
 */
export const dsu = (arr1, arr2) => arr1
    .map((item, index) => [arr2[index], item]) // add the args to sort by
    .sort(([arg1], [arg2]) => arg2 - arg1) // sort by the args
    .map(([, item]) => item); // extract the sorted items


/**
 * @param {Set} setA 
 * @param {Set} setB 
 * @returns {Set} Union of set A and B
 */
export function setUnion(setA, setB) {
    const union = new Set(setA);
    for (const elem of setB) {
        union.add(elem);
    }
    return union;
}


/**
 * @param {Set} setA 
 * @param {Set} setB 
 * @returns {Set} Union of set A and B
 */
export function setDifference(setA, setB) {
    let _difference = new Set(setA)
    for (let elem of setB) {
        _difference.delete(elem)
    }
    return _difference
}

/**
 * @param {Set} setA 
 * @param {Set} setB 
 * @returns {Set} Intersection of set A and B
 */
export function setIntersection(setA, setB) {
    let _intersection = new Set()
    for (let elem of setB) {
        if (setA.has(elem)) {
            _intersection.add(elem)
        }
    }
    return _intersection
}
