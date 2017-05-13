# mp4-format-check

Library for extracting formatting information from an MP4 file

### Usage

```javascript
Mp4FormatCheck.findFormats(file, function(_formats) {

    if(Mp4FormatCheck.containsH264Format(_formats)) {
        // We have a H.264 video stream
    }
    
}
```

