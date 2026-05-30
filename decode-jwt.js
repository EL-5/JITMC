const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJnZ29zZWN1ZnNyc2JhY2hsd213Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAxMjEwMTEsImV4cCI6MjA5NTY5NzAxMX0.8z2HZm7_8IMFOFylpZonPoBf7M1Eh2MzruVkPGF1w2g";
const payload = JSON.parse(Buffer.from(key.split('.')[1], 'base64').toString());
console.log(payload);
