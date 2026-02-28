let sectionCount = 0;
const editors = {}; // Store Quill editor instances
const STORAGE_KEY = 'documentEditorData';

function saveToLocalStorage() {
    const data = {
        sectionCount: sectionCount,
        sections: []
    };

    document.querySelectorAll('.section').forEach((section, index) => {
        const sectionNum = index + 1;
        const titleInput = section.querySelector('.title-input');
        const editor = editors[sectionNum];

        if (editor) {
            data.sections.push({
                sectionNum: sectionNum,
                title: titleInput.value,
                content: editor.root.innerHTML
            });
        }
    });

    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function loadFromLocalStorage() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return false;

    try {
        const data = JSON.parse(saved);
        sectionCount = data.sectionCount;

        // Restore sections
        data.sections.forEach(sectionData => {
            if (sectionData.sectionNum === 1 && sectionCount === 1) {
                // First section already created, just populate it
                const container = document.getElementById('sections-container');
                const section = container.querySelector('.section');
                const titleInput = section.querySelector('.title-input');
                titleInput.value = sectionData.title;

                setTimeout(() => {
                    const editor = editors[1];
                    if (editor) {
                        editor.root.innerHTML = sectionData.content;
                    }
                }, 100);
            } else if (sectionData.sectionNum > 1) {
                addSection();
            }
        });

        // Restore content for sections > 1
        setTimeout(() => {
            data.sections.forEach(sectionData => {
                if (sectionData.sectionNum > 1) {
                    const container = document.getElementById('sections-container');
                    const section = container.querySelector(`#section-${sectionData.sectionNum}`);
                    if (section) {
                        const titleInput = section.querySelector('.title-input');
                        titleInput.value = sectionData.title;

                        const editor = editors[sectionData.sectionNum];
                        if (editor) {
                            editor.root.innerHTML = sectionData.content;
                        }
                    }
                }
            });
        }, 200);

        return true;
    } catch (error) {
        console.error('Error loading from storage:', error);
        return false;
    }
}

function clearLocalStorage() {
    if (confirm('Are you sure you want to clear all saved data?')) {
        localStorage.removeItem(STORAGE_KEY);
        location.reload();
    }
}

function addSection() {
    sectionCount++;
    const container = document.getElementById('sections-container');

    const section = document.createElement('div');
    section.className = 'section';
    section.id = `section-${sectionCount}`;
    section.innerHTML = `
        <div class="section-header">
            <span class="section-number">Section ${sectionCount}</span>
            ${sectionCount > 1 ? `<button class="btn-danger" onclick="removeSection(${sectionCount})">✕ Remove</button>` : ''}
        </div>
        <input 
            type="text" 
            class="title-input" 
            placeholder="Enter section title..." 
            data-section="${sectionCount}">
        <div class="editor">
            <div class="drop-zone" id="drop-zone-${sectionCount}">📸 Drag images here</div>
            <div id="editor-${sectionCount}"></div>
        </div>
    `;

    container.appendChild(section);

    // Initialize Quill editor
    editors[sectionCount] = new Quill(`#editor-${sectionCount}`, {
        theme: 'snow',
        placeholder: 'Start typing...',
        modules: {
            toolbar: [
                [{ 'header': [1, 2, 3, false] }],
                ['bold', 'italic', 'underline', 'strike'],
                ['blockquote', 'code-block'],
                [{ 'list': 'ordered' }, { 'list': 'bullet' }],
                [{ 'align': [] }],
                ['link', 'image'],
                ['clean']
            ]
        }
    });

    // Setup drag and drop for this editor
    setupImageDragDrop(sectionCount);

    // Save to storage when content changes
    editors[sectionCount].on('text-change', saveToLocalStorage);
}

function removeSection(sectionNum) {
    const section = document.getElementById(`section-${sectionNum}`);
    delete editors[sectionNum];
    section.remove();
    saveToLocalStorage();
}

function setupImageDragDrop(sectionNum) {
    const editor = document.getElementById(`editor-${sectionNum}`);
    const dropZone = document.getElementById(`drop-zone-${sectionNum}`);
    const editorContainer = editor.parentElement;

    // Prevent default drag behaviors
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        editorContainer.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    // Highlight drop zone when dragging over it
    ['dragenter', 'dragover'].forEach(eventName => {
        editorContainer.addEventListener(eventName, () => {
            dropZone.classList.add('active');
        }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        editorContainer.addEventListener(eventName, () => {
            dropZone.classList.remove('active');
        }, false);
    });

    // Handle dropped files
    editorContainer.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        handleFiles(files, sectionNum);
    }, false);
}

function handleFiles(files, sectionNum) {
    const quillEditor = editors[sectionNum];

    for (let file of files) {
        if (!file.type.startsWith('image/')) {
            continue;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const imageUrl = e.target.result;
            const range = quillEditor.getSelection();
            const index = range ? range.index : quillEditor.getLength();
            quillEditor.insertEmbed(index, 'image', imageUrl);
            quillEditor.setSelection(index + 1);
        };
        reader.readAsDataURL(file);
    }
}

function exportToPDF() {
    const loading = document.getElementById('loading');
    loading.style.display = 'block';

    // Generate filename with today's date (YYYY-MM-DD)
    const today = new Date();
    const dateString = today.toISOString().split('T')[0];
    const filename = `document_${dateString}.pdf`;

    // Clone the sections container to avoid modifying the original
    const container = document.getElementById('sections-container');
    const containerClone = container.cloneNode(true);

    // Remove editor toolbars and drop zones from the clone
    containerClone.querySelectorAll('.ql-toolbar').forEach(el => el.remove());
    containerClone.querySelectorAll('.drop-zone').forEach(el => el.remove());
    containerClone.querySelectorAll('.btn-danger').forEach(el => el.remove());

    // Create wrapper with styles
    const wrapper = document.createElement('div');
    wrapper.style.padding = '10mm';
    wrapper.style.fontFamily = 'Arial, sans-serif';
    wrapper.style.lineHeight = '1.4';
    wrapper.style.fontSize = '11px';
    wrapper.style.backgroundColor = '#ffffff';

    // Add styling
    const style = document.createElement('style');
    style.textContent = `
        .section { 
            margin-bottom: 10mm; 
            page-break-inside: avoid;
        }
        .section-header { display: none; }
        .title-input { 
            display: block;
            width: 100%;
            border: none;
            padding: 4px 0;
            font-size: 14px;
            font-weight: bold;
            border-bottom: 1px solid #667eea;
            margin-bottom: 8px;
            background: white;
            color: #333;
        }
        .editor { display: none; }
        .ql-editor { 
            display: block !important;
            border: none !important;
            padding: 0 !important;
            min-height: auto !important;
        }
        img { max-width: 100%; height: auto; margin: 4px 0; }
        p { margin: 2px 0; }
        ul, ol { margin: 4px 0; padding-left: 20px; }
        blockquote { margin: 4px 0; padding-left: 10px; border-left: 2px solid #ccc; }
        .add-section-btn { display: none; }
        .ql-toolbar { display: none !important; }
        .drop-zone { display: none !important; }
    `;
    wrapper.appendChild(style);

    // Process each section to extract only the editor content
    containerClone.querySelectorAll('.section').forEach(section => {
        const titleInput = section.querySelector('.title-input');
        const editorDiv = section.querySelector('.ql-editor');

        // Create section div for PDF
        const pdfSection = document.createElement('div');
        pdfSection.className = 'pdf-section';
        pdfSection.style.marginBottom = '10mm';
        pdfSection.style.pageBreakInside = 'avoid';

        // Add title
        if (titleInput && titleInput.value) {
            const titleEl = document.createElement('h2');
            titleEl.textContent = titleInput.value;
            titleEl.style.fontSize = '14px';
            titleEl.style.fontWeight = 'bold';
            titleEl.style.color = '#333';
            titleEl.style.borderBottom = '1px solid #667eea';
            titleEl.style.paddingBottom = '4px';
            titleEl.style.marginBottom = '8px';
            titleEl.style.margin = '0 0 8px 0';
            pdfSection.appendChild(titleEl);
        }

        // Add content from editor
        if (editorDiv) {
            const contentClone = editorDiv.cloneNode(true);
            contentClone.style.border = 'none';
            contentClone.style.padding = '0';
            contentClone.style.color = '#444';
            pdfSection.appendChild(contentClone);
        }

        wrapper.appendChild(pdfSection);
    });

    // Export to PDF with A6 format
    const opt = {
        margin: [8, 8, 8, 8],
        filename: filename,
        image: { type: 'jpeg', quality: 0.95 },
        html2canvas: {
            scale: 2,
            useCORS: true,
            allowTaint: true,
            backgroundColor: '#ffffff',
            width: 105 * 3.78,
            windowHeight: 148 * 3.78
        },
        jsPDF: { orientation: 'portrait', unit: 'mm', format: 'a6' }
    };

    html2pdf()
        .set(opt)
        .from(wrapper)
        .save()
        .then(() => {
            loading.style.display = 'none';
        })
        .catch(err => {
            console.error('PDF export error:', err);
            loading.style.display = 'none';
            alert('Error exporting PDF. Check console for details.');
        });
}

// Add title input save listener
document.addEventListener('input', (e) => {
    if (e.target.classList.contains('title-input')) {
        saveToLocalStorage();
    }
});

// Add the first section on page load
window.addEventListener('load', () => {
    // Try to load saved data, otherwise create a fresh section
    if (!loadFromLocalStorage()) {
        addSection();
    }
});

// --- Blog System Integration ---

async function fetchBlogs() {
    try {
        const response = await fetch('http://localhost:3000/api/blogs');
        const data = await response.json();

        if (data.success) {
            const blogList = document.getElementById('blog-list');
            if (!blogList) return;

            blogList.innerHTML = '';

            data.blogs.forEach(blog => {
                const date = new Date(blog.created_at).toLocaleString();

                const item = document.createElement('a');
                item.className = 'blog-item';
                item.href = `blog.html?id=${blog.id}`;
                item.target = '_blank';

                item.innerHTML = `
                    <div class="blog-title">${blog.title}</div>
                    <div class="blog-date">${date}</div>
                `;

                blogList.appendChild(item);
            });
        }
    } catch (err) {
        console.error('Error fetching blogs:', err);
    }
}

async function createBlog() {
    const title = prompt("Enter a title for your new blog:");
    if (!title) return; // Cancelled or empty

    // Gather content from all sections
    let fullContent = '';

    // We clone the approach used in saving to get all sections
    document.querySelectorAll('.section').forEach((section, index) => {
        const sectionNum = index + 1;
        const sectionTitle = section.querySelector('.title-input').value;
        const editor = editors[sectionNum];

        if (editor) {
            if (sectionTitle) {
                fullContent += `<h2>${sectionTitle}</h2>`;
            }
            fullContent += editor.root.innerHTML;
        }
    });

    if (!fullContent.trim() || fullContent === '<p><br></p>') {
        alert("Cannot create an empty blog.");
        return;
    }

    const loading = document.getElementById('loading');
    loading.textContent = 'Creating Blog...';
    loading.style.display = 'block';

    try {
        const response = await fetch('http://localhost:3000/api/blogs', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                title: title,
                content: fullContent
            })
        });

        const data = await response.json();
        loading.style.display = 'none';

        loading.textContent = 'Generating PDF...'; // Reset text

        if (data.success) {
            alert('Blog created successfully!');
            fetchBlogs();
        } else {
            alert('Error creating blog: ' + data.error);
        }
    } catch (err) {
        loading.style.display = 'none';
        loading.textContent = 'Generating PDF...'; // Reset text
        console.error('Error creating blog:', err);
        alert('Error connecting to the server.');
    }
}

// Call fetchBlogs on load
window.addEventListener('DOMContentLoaded', fetchBlogs);
