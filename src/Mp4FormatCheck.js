Mp4FormatCheck = (function () {

    this.checker = function(_file) {
        
        var thisChecker = this;

        this.filePointer = 0;
        this.formatTypesFound = [];

        /**
         * @callback OnFinish
         * @param {OnFinish} _onFinish
         */
        this.run = function(_onFinish) {
            thisChecker.readNextFileSlice(_onFinish);
        };

        /**
         * @callback OnFinish
         * @param {File} _file
         * @param {OnFinish} _onFinish
         */
        this.readNextFileSlice = function(_onFinish) {         
            var data = _file.slice(thisChecker.filePointer, thisChecker.filePointer+8);
            thisChecker.filePointer += 8;
            if(data.size < 8) {
                _onFinish(thisChecker.formatTypesFound);
            } else {
                thisChecker.readBlob(data, _onFinish);
            }
        };    

        /**
         * @callback OnFinish
         * 
         * @param {Blob} _blob
         * @param {OnFinish} _onFinish
         */
        this.readBlob = function(_blob, _onFinish) {
            thisChecker.blobToArrayBuffer(_blob).then(function(_arrayBuffer) {
                var totalSize = new DataView(_arrayBuffer).getUint32(0, false);
                var boxType = thisChecker.readStringFromDataView(new DataView(_arrayBuffer), 4, 4);

                if(boxType === 'stsd') { // sample description atom
                    var atomDataBlob = _file.slice(thisChecker.filePointer, thisChecker.filePointer+(totalSize-8));
                    thisChecker.readStsdAtom(atomDataBlob).then(function() {
                        thisChecker.filePointer += totalSize-8;
                        thisChecker.readNextFileSlice(_onFinish);
                    });
                } else if(boxType === 'moov' || boxType === 'trak' || boxType === 'mdia' || boxType === 'minf' || boxType === 'stbl') { // containers
                    thisChecker.readNextFileSlice(_onFinish);                                                               
                } else { // skip data

                    if(totalSize === 1) {
                        var extBlob = _file.slice(thisChecker.filePointer, thisChecker.filePointer+8);
                        thisChecker.filePointer+=8;
                        thisChecker.blobToArrayBuffer(extBlob).then(function(_extBlobArrayBuffer) {
                            var extSize = thisChecker.stuffInt64BytesIntoNumber(_extBlobArrayBuffer);
                            thisChecker.filePointer += extSize;
                        });                          
                    }

                    thisChecker.filePointer += totalSize-8;
                    thisChecker.readNextFileSlice(_onFinish);
                }
            });
        };

        /**
         * @param {Blob} _atomDataBlob
         */
        this.readStsdAtom = function(_atomDataBlob) {
            return new Promise(function(_resolve, _reject) {
                var fileReader = new FileReader();
                fileReader.onload = function() {
                    var dv = new DataView(fileReader.result);

                    var version = dv.getUint8(0);
                    var fb1 = dv.getUint8(1);
                    var fb2 = dv.getUint8(2);
                    var fb3 = dv.getUint8(3);
                    var count = dv.getUint32(4, false);

                    var subStart = 8;
                    for(var i=0; i<count; i++) {
                        var len = dv.getUint32(subStart, false);
                        var type = thisChecker.readStringFromDataView(dv, subStart+4, 4);
                        var info = thisChecker.readStringFromDataView(dv, subStart+8, len-8);
                        var desc = thisChecker.readStringFromDataView(dv, subStart+len-8, 8);
                        subStart += len;

                        thisChecker.formatTypesFound.push({ "type": type.toLowerCase() });
                    }

                    _resolve();
                };

                fileReader.readAsArrayBuffer(_atomDataBlob);                    
            });
        };

        /**
         * @param {Blob} _blob
         */
        this.blobToArrayBuffer = function(_blob)  {
            return new Promise(function(_resolve, _reject) {
                var fileReader = new FileReader();
                fileReader.onload = function() {
                    _resolve(fileReader.result);
                };

                fileReader.readAsArrayBuffer(_blob);
            });
        };

        /**
         * @param {ArrayBuffer} _arrayBuffer
         */
        this.stuffInt64BytesIntoNumber = function(_arrayBuffer)
        {
            // get a DataView over the ArrayBuffer
            var dv = new DataView(_arrayBuffer);

            // read bytes from DataView into array
            var bytes = [];
            for(let i=0; i<8; i++) {
                bytes.push( dv.getUint8(i) );
            }

            // turn each byte into a padded, binary string
            var binaryStringsArr = bytes.map(function(b) { 
                return b.toString(2).padStart(8, "0");
            });

            // concat into binary string
            var binaryString = binaryStringsArr.join('');

            // parse as Number (accurate up to 52 bits, precision loss after that)
            return parseInt(binaryString, 2);
        };    

        /**
         * @param {DataView} _dataView
         * @param {Number} _startIndex
         * @param {Number} _length
         */
        this.readStringFromDataView = function(_dataView, _startIndex, _length)
        {
            var result = "";
            for(var i=0; i<_length; i++) {
                result += String.fromCharCode(_dataView.getInt8(_startIndex+i));
            }

            return result;
        }
    };

    return {

        /**
         * @callback OnFindComplete
         * @param {File} _file
         * @param {OnFindComplete} _onFindComplete
         */
        findFormats: function(_file, _onFindComplete) {
            var c = new checker(_file);
            c.run(function(_formats) {
                _onFindComplete(_formats);
            });
        },

        /**
         * @param {Array} _formats
         * @return {Boolean}
         */
        containsH264Format: function(_formats) {
            for(let i=0; i<_formats.length; i++) {
                if(_formats[i].type === 'h264' || _formats[i].type === 'avc1') {
                    return true;
                }
            }

            return false;
        }
    };
})();

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Mp4FormatCheck;
}
