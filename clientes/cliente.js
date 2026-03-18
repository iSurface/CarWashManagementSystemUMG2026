async function login(){

let email = document.getElementById("email").value
let password = document.getElementById("password").value

const res = await fetch("http://localhost:3000/login",{
method:"POST",
headers:{
"Content-Type":"application/json"
},
body:JSON.stringify({email,password})
})

const data = await res.json()

if(data.ok){

localStorage.setItem("cliente",data.id)

window.location="dashboard.html"

}else{

alert("Credenciales incorrectas")

}

}

async function recargar(){

let monto = document.getElementById("monto").value
let cliente = localStorage.getItem("cliente")

const res = await fetch("http://localhost:3000/recargar",{
method:"POST",
headers:{
"Content-Type":"application/json"
},
body:JSON.stringify({
cliente:cliente,
monto:monto
})
})

const data = await res.json()

if(data.ok){

alert("Saldo recargado correctamente")

window.location="dashboard.html"

}else{

alert("Error al recargar")

}

}
async function registrar(){

let nombre = document.getElementById("nombre").value
let email = document.getElementById("email").value
let password = document.getElementById("password").value
let tarjeta = document.getElementById("tarjeta").value

const res = await fetch("http://localhost:3000/registro",{
method:"POST",
headers:{
"Content-Type":"application/json"
},
body:JSON.stringify({
nombre:nombre,
email:email,
password:password,
tarjeta:tarjeta
})
})

const data = await res.json()

if(data.ok){

alert("Cuenta creada correctamente")

window.location="login.html"

}else{

alert("Error al registrar")

}

}
async function cargarDatos(){

  let cliente = localStorage.getItem("cliente");

  if(!cliente){
    window.location = "login.html";
    return;
  }

  const res = await fetch("http://localhost:3000/cliente/" + cliente);
  const data = await res.json();

  document.getElementById("codigo").innerText = data.uid || "Sin tarjeta";
  document.getElementById("saldo").innerText = "Q" + (data.saldo ?? 0);
  document.getElementById("bienvenida").innerText = "Bienvenido " + (data.nombre || "");

  cargarHistorialLavados();
}
function cerrarSesion(){
  localStorage.removeItem("cliente");
  window.location = "login.html";
}
async function cargarHistorialLavados(){

  let cliente = localStorage.getItem("cliente");

  if(!cliente) return;

  const res = await fetch("http://localhost:3000/lavados/" + cliente);
  const data = await res.json();

  const contenedor = document.getElementById("historialLavados");

  if(!contenedor) return;

  if(!data || data.length === 0){
    contenedor.innerHTML = `<p class="helper">Aún no hay lavados registrados.</p>`;
    return;
  }

  contenedor.innerHTML = "";

  data.slice(0, 5).forEach(lavado => {
    const item = document.createElement("div");
    item.className = "history-item";

    const fecha = new Date(lavado.fecha).toLocaleString();

    item.innerHTML = `
      <div class="history-left">
        <div class="history-title">${lavado.tipo}</div>
        <div class="history-date">${fecha}</div>
      </div>
      <div class="history-price">Q${lavado.precio}</div>
    `;

    contenedor.appendChild(item);
  });
}