const API = "http://localhost:3000";
let grafica = null;

async function cargarResumen() {
  const res = await fetch(API + "/admin/resumen");
  const data = await res.json();

  document.getElementById("statClientes").innerText = data.totalClientes ?? 0;
  document.getElementById("statTarjetas").innerText = data.totalTarjetas ?? 0;
  document.getElementById("statGenerado").innerText = "Q" + (data.dineroGenerado ?? 0);
  document.getElementById("statCaja").innerText = "Q" + (data.dineroCaja ?? 0);
}

async function cargarPrecios() {
  const res = await fetch(API + "/admin/precios");
  const data = await res.json();

  const normal = data.find(p => p.tipo === "NORMAL");
  const intensivo = data.find(p => p.tipo === "INTENSIVO");

  document.getElementById("precioNormal").value = normal ? normal.precio : 25;
  document.getElementById("precioIntensivo").value = intensivo ? intensivo.precio : 40;
}

async function guardarPrecios() {
  const normal = document.getElementById("precioNormal").value;
  const intensivo = document.getElementById("precioIntensivo").value;

  const res = await fetch(API + "/admin/precios", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ normal, intensivo })
  });

  const data = await res.json();

  if (data.ok) {
    alert("Precios actualizados correctamente");
    cargarPrecios();
  } else {
    alert("Error al actualizar precios");
  }
}

async function cargarUsuarios() {
  const res = await fetch(API + "/admin/usuarios");
  const data = await res.json();

  const tabla = document.getElementById("tablaUsuariosAdmin");
  tabla.innerHTML = "";

  data.forEach(usuario => {
    const fila = document.createElement("tr");

    fila.innerHTML = `
      <td>${usuario.nombre ?? ""}</td>
      <td>${usuario.email ?? ""}</td>
      <td>${usuario.uid ?? "Sin tarjeta"}</td>
      <td>Q${usuario.saldo ?? 0}</td>
    `;

    tabla.appendChild(fila);
  });
}

async function cargarGraficaIngresos() {
  const res = await fetch(API + "/admin/grafica-ingresos");
  const data = await res.json();

  const labelsFormateados = data.labels.map(fecha => {
    const d = new Date(fecha);
    return d.toLocaleDateString("es-GT");
  });

  const ctx = document.getElementById("graficaIngresos");

  if (grafica) {
    grafica.destroy();
  }

  grafica = new Chart(ctx, {
    type: "bar",
    data: {
      labels: labelsFormateados,
      datasets: [{
        label: "Ingresos por día",
        data: data.valores,
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          display: true
        }
      },
      scales: {
        y: {
          beginAtZero: true
        }
      }
    }
  });
}

async function cargarResumenFinanciero() {
  const res = await fetch(API + "/admin/resumen-financiero");
  const data = await res.json();

  document.getElementById("statNormales").innerText = data.normales ?? 0;
  document.getElementById("statIntensivos").innerText = data.intensivos ?? 0;
  document.getElementById("statIngresoNormal").innerText = "Q" + (data.ingresoNormal ?? 0);
  document.getElementById("statIngresoIntensivo").innerText = "Q" + (data.ingresoIntensivo ?? 0);
}

function exportarExcel() {
  window.open(API + "/admin/exportar-excel", "_blank");
}

async function cargarAdmin() {
  await Promise.all([
    cargarResumen(),
    cargarPrecios(),
    cargarUsuarios(),
    cargarGraficaIngresos(),
    cargarResumenFinanciero()
  ]);
}

window.onload = cargarAdmin;