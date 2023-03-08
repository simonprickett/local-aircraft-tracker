import FlipDot from 'flipdot-display';
const flippy = new FlipDot('/dev/ttyUSB0', 6, 7, 84);

async function sleep(millis) {
  return new Promise((resolve) => {
    setTimeout(resolve, millis);
  });
};

function pixelWidth(msg) {
  let pixelCount = 0;

  for (const char of msg) {
    pixelCount += (char === ' ' ? 1 : 9);
  }

  return pixelCount;
}

flippy.on('error', function(err) {
  console.log('ERROR:');
  console.log(err);
});
 
flippy.once('open', async function() {
  let reps = 1;

  const displayData = function(lines) {
    let currLine = 0;

    const i = setInterval(function() {
      if (currLine < lines.length) {
 
        const xOffset = Math.floor((84 - pixelWidth(lines[currLine])) / 2);
        console.log(`msg: ${lines[currLine]}, offset: ${xOffset}`);
        flippy.writeText(lines[currLine], { font: 'Banner3' }, [0, xOffset], false, true);
        flippy.send(); 
      } else {
        clearInterval(i);
        flippy.fill(0xFF);

        console.log(`reps = ${reps}`);
        if (reps < 2) {
          reps++;
          displayData(lines);
        } else {
          reps = 0;
        }
      }

      currLine++;
    }, 1500);
  };

  displayData([ 'BA287', 'A388', 'G-XLEA', 'LHR - SFO', '30924FT' ]);
});
