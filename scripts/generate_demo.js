const fs = require('fs');
const PDFDocument = require('pdfkit');

if (!fs.existsSync('test-files')) {
    fs.mkdirSync('test-files');
}

const createPDF = (fileName, content) => {
    const doc = new PDFDocument();
    doc.pipe(fs.createWriteStream(`test-files/${fileName}`));

    doc.fontSize(25).text(fileName, 100, 100);
    doc.fontSize(12).moveDown();
    doc.text(content, {
        width: 410,
        align: 'justify'
    });

    doc.end();
    console.log(`Generated ${fileName}`);
};

// Version 1 (2025)
createPDF('Policy.pdf',
    `REMOTE WORK POLICY (2025)

1. Work Days: Employees are expected to be in the office 3 days a week.
2. Core Hours: 10 AM to 4 PM.
3. Equipment: The company provides a laptop and a monitor.
   
Effectiveness: This policy is valid starting Jan 1, 2025.
`);

// Version 2 (2026 Updated) - This one conflicts with V1 on "Work Days"
// Note: We name it 'Policy.pdf' as well if we were uploading sequentially to trigger versioning, 
// but for the user to have distinct files on disk, we'll name them differently 
// and instruct them to rename/upload as the same name to test versioning.
// OR easier: just name them differently but tell the user "This is your update".
// The user request asked for "Policy_2025.pdf" and "Policy_2026_Updated.pdf".

createPDF('Policy_2026_Updated.pdf',
    `REMOTE WORK POLICY (2026 UPDATE)

1. Work Days: Employees are now fully remote allowed! No office days required.
2. Core Hours: Flexible.
3. Equipment: $500 stipend provided.

Effectiveness: This policy updates all previous agreements starting Jan 1, 2026.
`);

console.log('✅ Demo files created in /test-files');
