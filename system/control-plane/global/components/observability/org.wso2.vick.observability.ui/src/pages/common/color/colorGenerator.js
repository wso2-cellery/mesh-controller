/*
 * Copyright (c) 2018, WSO2 Inc. (http://www.wso2.org) All Rights Reserved.
 *
 * WSO2 Inc. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import randomColor from "randomcolor";

/**
 * Color Generator.
 */
class ColorGenerator {

    constructor() {
        this.colorMap = {};

        this.addKeys([
            ColorGeneratorConstants.VICK,
            ColorGeneratorConstants.ISTIO
        ]);
        this.colorMap[ColorGeneratorConstants.ERROR] = "#ff282a";
    }

    /**
     * Add a list of keys to the current exiting keys.
     *
     * @param {Array.<string>} keys The array of keys to add to the current keys
     */
    addKeys(keys = []) {
        const self = this;
        const newKeys = keys.filter((key) => !(key in self.colorMap));
        const colors = ColorGenerator.generateColors(newKeys.length);

        for (let i = 0; i < newKeys.length; i++) {
            self.colorMap[newKeys[i]] = colors[i];
        }
    }

    /**
     * Get the color for a particular key.
     * If the key does not already exist the key will be added and a new color scheme will be generated.
     *
     * @param {string} key The name of the key
     * @returns {string} Hex value for a particular color
     */
    getColor(key) {
        if (!(key in this.colorMap)) {
            this.addKeys([key]);
        }
        return this.colorMap[key];
    }

    /**
     * Regenerate a new color scheme for the existing keys.
     * This will remove all the previous colors used and generate a new set of colors.
     */
    regenerateNewColorScheme() {
        const keyCount = Object.keys(this.colorMap).length;
        const colors = ColorGenerator.generateColors(keyCount);

        let i = 0;
        for (const key in this.colorMap) {
            if (this.colorMap.hasOwnProperty(key)) {
                this.colorMap[key] = colors[i];
                i += 1;
            }
        }
    }

    /**
     * Generate a set of colors.
     *
     * @private
     * @param {number} count The number of colors to generate
     * @returns {Array.<string>} The colors generated
     */
    static generateColors(count) {
        return randomColor({
            luminosity: "light",
            count: count
        });
    }

}

const ColorGeneratorConstants = {
    VICK: "VICK",
    ISTIO: "Istio",
    ERROR: "ERROR"
};

export {ColorGenerator, ColorGeneratorConstants};
