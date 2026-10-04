// Logistics Management System · Frontend logic
// Owner: Chi Xuanyi
// Note: call the backend APIs with fetch, e.g.:
//   fetch('http://localhost:8000/api/shipments')
//     .then(r => r.json())
//     .then(data => console.log(data));

document.getElementById('loginBtn').onclick = () => {
  const user = document.getElementById('username').value;
  alert(user ? `Welcome, ${user}!` : 'Please enter a username');
};
