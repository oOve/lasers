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
  


export function vSub(p1, p2){
    return {x:p1.x-p2.x, y:p1.y-p2.y };
}
export function vAdd(p1, p2){
    return {x:p1.x+p2.x, y:p1.y+p2.y };
}

export function vAngle(p){
    return 90+Math.toDegrees(Math.atan2(p.y, p.x));
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
