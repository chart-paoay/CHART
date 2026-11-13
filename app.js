// Register Service Worker for offline availability
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js');
}

// Initialize Offline Database using Dexie
const db = new Dexie('ChartPaoayDB');
db.version(1).stores({
  children: 'childId, name, passwordHash, weight, height, bmi, status'
});

// Secure Password Hashing Function (SHA-256)
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Save Record Offline (BHW Action) & Refresh List
async function saveRecord() {
  const childId = document.getElementById('child-id').value.trim();
  const name = document.getElementById('child-name').value.trim();
  const rawPass = document.getElementById('parent-pass').value;
  const weight = parseFloat(document.getElementById('weight').value);
  const heightCm = parseFloat(document.getElementById('height').value);

  if (!childId || !name || !rawPass || isNaN(weight) || isNaN(heightCm)) {
    alert('Please fill in all fields correctly.');
    return;
  }

  const heightM = heightCm / 100;
  const bmi = (weight / (heightM * heightM)).toFixed(2);
  const status = bmi < 14 ? 'Underweight' : (bmi > 18 ? 'Overweight' : 'Normal');

  const passwordHash = await hashPassword(rawPass);

  await db.children.put({
    childId, name, passwordHash, weight, height: heightCm, bmi, status
  });

  alert('Record saved offline successfully!');

  // Clear form inputs
  document.getElementById('child-id').value = '';
  document.getElementById('child-name').value = '';
  document.getElementById('parent-pass').value = '';
  document.getElementById('weight').value = '';
  document.getElementById('height').value = '';

  loadBhwRecords();
}

// Load and Organize Records for BHW Dashboard
async function loadBhwRecords() {
  const allChildren = await db.children.toArray();
  const container = document.getElementById('records-container');
  
  if (allChildren.length === 0) {
    container.innerHTML = '<p style="text-align: center; color: #666;">No records saved yet.</p>';
    return;
  }

  let html = `
    <table border="1" style="width:100%; border-collapse: collapse; font-size: 14px; text-align: left;">
      <thead>
        <tr style="background-color: #2d6a4f; color: white;">
          <th style="padding: 6px;">ID</th>
          <th style="padding: 6px;">Name</th>
          <th style="padding: 6px;">BMI</th>
          <th style="padding: 6px;">Status</th>
        </tr>
      </thead>
      <tbody>
  `;

  allChildren.forEach(child => {
    html += `
      <tr>
        <td style="padding: 6px;">${child.childId}</td>
        <td style="padding: 6px;">${child.name}</td>
        <td style="padding: 6px;">${child.bmi}</td>
        <td style="padding: 6px; font-weight: bold; color: ${child.status === 'Normal' ? '#2d6a4f' : '#bc4749'};">${child.status}</td>
      </tr>
    `;
  });

  html += `</tbody></table>`;
  container.innerHTML = html;
}

// Role-Based Login & Privacy Enforcement
async function handleLogin() {
  const role = document.getElementById('role-select').value;
  const user = document.getElementById('username').value.trim();
  const pass = document.getElementById('password').value;

  if (role === 'bhw') {
    if (user === 'admin' && pass === 'paoay2027') {
      document.getElementById('login-section').style.display = 'none';
      document.getElementById('bhw-dashboard').style.display = 'block';
      loadBhwRecords();
    } else {
      alert('Invalid BHW credentials.');
    }
  } else if (role === 'parent') {
    const record = await db.children.get(user);
    if (!record) return alert('Child ID not found.');

    const enteredHash = await hashPassword(pass);
    if (enteredHash === record.passwordHash) {
      document.getElementById('login-section').style.display = 'none';
      document.getElementById('parent-portal').style.display = 'block';
      
      document.getElementById('my-child-data').innerHTML = `
        <p><strong>Child ID:</strong> ${record.childId}</p>
        <p><strong>Name:</strong> ${record.name}</p>
        <p><strong>Weight:</strong> ${record.weight} kg | <strong>Height:</strong> ${record.height} cm</p>
        <p><strong>BMI:</strong> ${record.bmi} (${record.status})</p>
      `;
    } else {
      alert('Incorrect password.');
    }
  }
}

function logout() {
  location.reload();
}