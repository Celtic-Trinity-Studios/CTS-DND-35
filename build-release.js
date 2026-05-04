const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

// Ensure dist directory exists
const outputDir = path.join(__dirname, 'dist');
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir);
}

const outputFile = path.join(outputDir, 'CTS-DND-35.zip');
if (fs.existsSync(outputFile)) {
    fs.unlinkSync(outputFile);
}
const output = fs.createWriteStream(outputFile);
const archive = archiver('zip', {
    zlib: { level: 9 } // Max compression
});

output.on('close', function() {
    console.log(`\n=========================================`);
    console.log(`✅ Build Successful!`);
    console.log(`📦 Output: dist/CTS-DND-35.zip`);
    console.log(`🗜️  Size: ${(archive.pointer() / 1024 / 1024).toFixed(2)} MB`);
    console.log(`=========================================`);
    console.log(`This zip file is clean and ready to be uploaded to your GitHub Releases.\n`);
});

archive.on('warning', function(err) {
    if (err.code === 'ENOENT') {
        console.warn('Warning:', err);
    } else {
        throw err;
    }
});

archive.on('error', function(err) {
    throw err;
});

archive.pipe(output);

// Top level files to include.
// Intentionally exclude legacy template.json from release artifacts.
const filesToInclude = ['system.json', 'README.md', 'LICENSE.txt', 'LICENSE'];
filesToInclude.forEach(file => {
    if (fs.existsSync(path.join(__dirname, file))) {
        archive.file(path.join(__dirname, file), { name: file });
    }
});

// Top level directories to include entirely
const dirsToInclude = ['assets', 'css', 'docs', 'lang', 'module', 'templates'];
dirsToInclude.forEach(dir => {
    if (fs.existsSync(path.join(__dirname, dir))) {
        archive.directory(path.join(__dirname, dir), dir);
    }
});

// Packs directory (we specifically exclude the raw JSON _source directories)
if (fs.existsSync(path.join(__dirname, 'packs'))) {
    archive.glob('packs/**', {
        cwd: __dirname,
        ignore: ['packs/**/_source', 'packs/**/_source/**']
    });
}

archive.finalize();
