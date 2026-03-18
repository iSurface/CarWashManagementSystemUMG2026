const estadosBase = [
  "Pre-Lavado",
  "Enjabonado",
  "Cepillado",
  "Desaguado",
  "Secado"
];

let tipoLavado = "NORMAL";
let ticket = 1;
let ultimoEstado = -2; // para detectar cambios
let ultimoFinalizado = false;

// CAMBIAR TIPO DE LAVADO
function setTipoLavado(tipo) {
  tipoLavado = tipo === "intenso" ? "intenso" : "normal";
  document.getElementById("tipoLavado").innerText = tipoLavado.toUpperCase();
}

// ACTUALIZAR INTERFAZ SEGUN FASE
function actualizarEstado(fase) {
  if (fase < 0 || fase > 4) return;

  document.getElementById("estado").innerText = estadosBase[fase];
  document.getElementById("tipoLavado").innerText = tipoLavado.toUpperCase();

  actualizarBarra(fase);
  activarPaso(fase);
}

// BARRA DE PROGRESO
function actualizarBarra(fase) {
  const porcentaje = ((fase + 1) / estadosBase.length) * 100;
  document.getElementById("progress").style.width = porcentaje + "%";
}

// INDICADORES DE PASOS
function activarPaso(num) {
  for (let i = 0; i < 5; i++) {
    const step = document.getElementById("step" + i);
    if (step) {
      step.classList.remove("active");
    }
  }

  const actual = document.getElementById("step" + num);
  if (actual) {
    actual.classList.add("active");
  }
}

// FINALIZAR LAVADO EN PANTALLA
function finalizarLavado() {
  agregarHistorial(ticket);

  ticket++;
  document.getElementById("ticket").innerText = ticket.toString().padStart(3, "0");

  document.getElementById("progress").style.width = "0%";
  document.getElementById("estado").innerText = "Esperando Vehículo";

  for (let i = 0; i < 5; i++) {
    const step = document.getElementById("step" + i);
    if (step) {
      step.classList.remove("active");
    }
  }
}

// HISTORIAL
function agregarHistorial(ticketActual) {
  const tabla = document.getElementById("tablaHistorial");
  const fila = document.createElement("tr");
  const hora = new Date().toLocaleTimeString();

  fila.innerHTML = `
    <td>${ticketActual.toString().padStart(3, "0")}</td>
    <td>${hora}</td>
    <td>${tipoLavado}</td>
  `;

  tabla.prepend(fila);
}

// LEER ESTADO DEL SERVIDOR
async function actualizarEstadoServidor() {
  try {
    const res = await fetch("http://localhost:3000/estado");
    const data = await res.json();

    console.log("Estado recibido:", data);

    document.getElementById("contador").innerText = data.autos;
    document.getElementById("clienteActual").innerText = data.cliente || "Esperando...";
    
    tipoLavado = data.tipo || "NORMAL";
    document.getElementById("tipoLavado").innerText = tipoLavado;

    if (data.fase >= 0) {
      ultimoFinalizado = false;

      if (data.fase !== ultimoEstado) {
        ultimoEstado = data.fase;
        actualizarEstado(data.fase);
      }
    } else {
      if (!ultimoFinalizado && ultimoEstado >= 0) {
        finalizarLavado();
        ultimoFinalizado = true;
      }

      ultimoEstado = -1;
    }
  } catch (error) {
    console.log("Error conectando al servidor:", error);
  }
}

// iniciar consulta constante
setInterval(actualizarEstadoServidor, 1000);

// primera carga inmediata
actualizarEstadoServidor();
// ============================
// SIMULADOR DE ARDUINO
// ============================ 
/*
let simulacionActiva = true;

function iniciarSimulacion(){

if(!simulacionActiva) return;

// elegir tipo de lavado aleatorio
let tipo = Math.random() > 0.5 ? "normal" : "intenso";

setTipoLavado(tipo);

console.log("Nuevo lavado:", tipo);

let intervalo = setInterval(()=>{

actualizarEstado();

if(pasoActual === 0){

clearInterval(intervalo);

// esperar carro siguiente
setTimeout(iniciarSimulacion,10000);

}

},8000);

}

// iniciar simulacion automaticamente
window.onload = function(){

setTimeout(iniciarSimulacion,10000);

}; */