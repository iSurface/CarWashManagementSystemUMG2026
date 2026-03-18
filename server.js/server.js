const express = require("express");
const mysql = require("mysql2");
const cors = require("cors");
const { SerialPort } = require("serialport");
const { ReadlineParser } = require("@serialport/parser-readline");

const app = express();

let faseActual = -1;
let autosLavados = 0;
let lavadoEnProceso = false;
let lavadoPendiente = false;
let tipoPendiente = "NORMAL";
let ultimaTarjeta = null;
let tiempoUltimaLectura = 0;
let clienteActual = "Ninguno";
let tipoLavadoActual = "Normal";

app.use(cors());
app.use(express.json());


const db = mysql.createConnection({
  host: "sql.freedb.tech",
  user: "freedb_admincarwash",
  password: "a2h3j?$uz39%MYn",
  database: "freedb_umgcarwash",
  port: 3306
});

db.connect((err) => {
  if (err) {
    console.log("Error conexion:", err);
  } else {
    console.log("Conectado a MySQL FreeDB");
  }
});


const port = new SerialPort({
  path: "COM6",
  baudRate: 9600
});

const parser = port.pipe(new ReadlineParser({ delimiter: "\r\n" }));

function enviarArduino(mensaje) {
  if (port && port.isOpen) {
    port.write(mensaje + "\n");
    console.log("Enviado a Arduino:", mensaje);
  }
}

function limpiarBloqueoTarjeta() {
  ultimaTarjeta = null;
  tiempoUltimaLectura = 0;
}

parser.on("data", (data) => {

  data = data.trim();
  console.log("Arduino:", data);


  if (data === "CARRO_OK") {
    console.log("Carro detectado");

    if (lavadoPendiente && !lavadoEnProceso) {
      console.log("Iniciando lavado...");

      lavadoEnProceso = true;
      lavadoPendiente = false;

      iniciarLavado(tipoPendiente);
    }

    return;
  }

  
  if (lavadoEnProceso || lavadoPendiente) return;

 
  if (!data.startsWith("UID:")) return;

  const partes = data.split("|");

  const uid = partes[0].replace("UID:", "").trim();
  const tipo = partes[1]
    ? partes[1].replace("TIPO:", "").trim()
    : "NORMAL";

  const ahora = Date.now();

  if (uid === ultimaTarjeta && (ahora - tiempoUltimaLectura) < 5000) {
    return;
  }

  ultimaTarjeta = uid;
  tiempoUltimaLectura = ahora;

  verificarTarjeta(uid, tipo);
});
port.on("open", () => {
  console.log("Puerto serial abierto correctamente");
});

port.on("error", (err) => {
  console.log("Error en puerto serial:", err.message);
});


function verificarTarjeta(uid, tipo) {

  if (lavadoEnProceso || lavadoPendiente) {
    console.log("Sistema ocupado...");
    return;
  }

  console.log("Tarjeta detectada:", uid);
  console.log("Tipo:", tipo);

  db.query(
    `SELECT tarjetas.*, clientes.nombre
     FROM tarjetas
     JOIN clientes ON tarjetas.cliente_id = clientes.id
     WHERE tarjetas.uid = ?`,
    [uid],
    (err, result) => {

      if (err) {
        console.log(err);
        return;
      }

      if (result.length === 0) {
        console.log("Tarjeta no registrada");
        enviarArduino("NO_REGISTRADA");
        return;
      }

      const tarjeta = result[0];
      clienteActual = tarjeta.nombre || "Cliente";

      // Obtener el precio desde la tabla precios
      db.query(
        "SELECT precio FROM precios WHERE UPPER(tipo) = ?",
        [tipo.toUpperCase()],
        (errPrecio, resultPrecio) => {

          if (errPrecio) {
            console.log("Error obteniendo precio:", errPrecio);
            return;
          }

          if (resultPrecio.length === 0) {
            console.log("No se encontró precio para el tipo:", tipo);
            return;
          }

          const costo = Number(resultPrecio[0].precio);

          if (Number(tarjeta.saldo) < costo) {
            console.log("Saldo insuficiente");
            enviarArduino("SIN_FONDOS");
            return;
          }

          const nuevoSaldo = Number(tarjeta.saldo) - costo;

          db.query(
            "UPDATE tarjetas SET saldo = ? WHERE uid = ?",
            [nuevoSaldo, uid],
            (errUpdate) => {
              if (errUpdate) {
                console.log("Error actualizando saldo:", errUpdate);
                return;
              }

              console.log("Pago aprobado. Cobrado:", costo);

              enviarArduino("PAGO_OK");

              db.query(
                "INSERT INTO lavados(tarjeta_id, tipo, precio) VALUES(?,?,?)",
                [tarjeta.id, tipo.toUpperCase(), costo],
                (errInsert) => {
                  if (errInsert) {
                    console.log("Error insertando lavado:", errInsert);
                    return;
                  }

                  tipoPendiente = tipo.toUpperCase();
                  tipoLavadoActual = tipo.toUpperCase();
                  lavadoPendiente = true;

                  console.log("Esperando que pase el carro...");
                }
              );
            }
          );
        }
      );
    }
  );
}

function iniciarLavado(tipo) {

  const normal = [0,1,2,3,4];
  const intensivo = [0,1,2,3,1,2,3,4];

  const secuencia = tipo === "INTENSIVO" ? intensivo : normal;

  secuencia.forEach((fase, i) => {
    setTimeout(() => {
      faseActual = fase;
      enviarArduino("FASE_" + fase);
      console.log("Fase:", fase);
    }, i * 5000);
  });

  setTimeout(() => {
    autosLavados++;
    faseActual = -1;
    lavadoEnProceso = false;
    lavadoPendiente = false;

    clienteActual = "Ninguno";
    tipoLavadoActual = "NORMAL";

    ultimaTarjeta = null;
    tiempoUltimaLectura = 0;

    enviarArduino("FIN");

    console.log("Lavado terminado");

  }, secuencia.length * 5000);
}


app.post("/registro", (req, res) => {
  const { nombre, email, password, tarjeta } = req.body;

  db.query(
    "INSERT INTO clientes(nombre, email, password) VALUES (?, ?, ?)",
    [nombre, email, password],
    (err, result) => {
      if (err) {
        console.log("Error en registro cliente:", err);
        return res.json({ ok: false, error: err.message });
      }

      const clienteID = result.insertId;

      db.query(
        "INSERT INTO tarjetas(uid, cliente_id, saldo) VALUES (?, ?, 0)",
        [tarjeta, clienteID],
        (err2) => {
          if (err2) {
            console.log("Error en registro tarjeta:", err2);
            return res.json({ ok: false, error: err2.message });
          }

          res.json({ ok: true });
        }
      );
    }
  );
});

app.get("/lavados/:id", (req, res) => {
  const id = req.params.id;

  db.query(
    `SELECT lavados.tipo, lavados.precio, lavados.fecha
     FROM lavados
     JOIN tarjetas ON lavados.tarjeta_id = tarjetas.id
     WHERE tarjetas.cliente_id = ?
     ORDER BY lavados.fecha DESC
     LIMIT 5`,
    [id],
    (err, result) => {
      if (err) {
        console.log("Error consultando historial de lavados:", err);
        return res.json([]);
      }

      res.json(result);
    }
  );
});



app.post("/login", (req, res) => {
  const { email, password } = req.body;

  db.query(
    "SELECT * FROM clientes WHERE email = ? AND password = ?",
    [email, password],
    (err, result) => {
      if (err) {
        console.log("Error login:", err);
        return res.json({ ok: false });
      }

      if (result.length > 0) {
        res.json({ ok: true, id: result[0].id });
      } else {
        res.json({ ok: false });
      }
    }
  );
});


app.get("/saldo/:uid", (req, res) => {
  const uid = req.params.uid;

  db.query(
    "SELECT saldo FROM tarjetas WHERE uid = ?",
    [uid],
    (err, result) => {
      if (err) {
        console.log("Error consultando saldo:", err);
        return res.json({ saldo: 0 });
      }

      if (result.length > 0) {
        res.json(result[0]);
      } else {
        res.json({ saldo: 0 });
      }
    }
  );
});


app.post("/recargar", (req, res) => {
  const { cliente, monto } = req.body;

  db.query(
    `UPDATE tarjetas
     SET saldo = saldo + ?
     WHERE cliente_id = ?`,
    [monto, cliente],
    (err) => {
      if (err) {
        console.log("Error recargando saldo:", err);
        return res.json({ ok: false });
      }

      res.json({ ok: true });
    }
  );
});


app.get("/cliente/:id",(req,res)=>{

const id = req.params.id

db.query(
`SELECT clientes.nombre, tarjetas.uid, tarjetas.saldo
FROM tarjetas
JOIN clientes
ON tarjetas.cliente_id = clientes.id
WHERE clientes.id = ?`,
[id],
(err,result)=>{

if(err){
console.log(err)
return res.json({})
}

res.json(result[0])

})

})


app.get("/estado", (req, res) => {
  res.json({
    fase: faseActual,
    autos: autosLavados,
    tipo: tipoLavadoActual,
    cliente: clienteActual
  });
});
app.get("/admin/resumen", (req, res) => {
  const resumen = {
    totalClientes: 0,
    totalTarjetas: 0,
    dineroGenerado: 0,
    dineroCaja: 0
  };

  db.query("SELECT COUNT(*) AS total FROM clientes", (err1, r1) => {
    if (err1) return res.json(resumen);
    resumen.totalClientes = r1[0].total;

    db.query("SELECT COUNT(*) AS total FROM tarjetas", (err2, r2) => {
      if (err2) return res.json(resumen);
      resumen.totalTarjetas = r2[0].total;

      db.query("SELECT IFNULL(SUM(precio),0) AS total FROM lavados", (err3, r3) => {
        if (err3) return res.json(resumen);
        resumen.dineroGenerado = r3[0].total;

        db.query("SELECT IFNULL(SUM(saldo),0) AS total FROM tarjetas", (err4, r4) => {
          if (err4) return res.json(resumen);
          resumen.dineroCaja = r4[0].total;

          res.json(resumen);
        });
      });
    });
  });
});
app.get("/admin/usuarios", (req, res) => {
  db.query(
    `SELECT clientes.nombre, clientes.email, tarjetas.uid, tarjetas.saldo
     FROM clientes
     LEFT JOIN tarjetas ON tarjetas.cliente_id = clientes.id
     ORDER BY clientes.nombre ASC`,
    (err, result) => {
      if (err) {
        console.log(err);
        return res.json([]);
      }
      res.json(result);
    }
  );
});
app.get("/admin/precios", (req, res) => {
  db.query(
    `SELECT tipo, precio FROM precios ORDER BY tipo ASC`,
    (err, result) => {
      if (err) {
        console.log(err);
        return res.json([]);
      }
      res.json(result);
    }
  );
});
app.post("/admin/precios", (req, res) => {
  const { normal, intensivo } = req.body;

  db.query(
    `UPDATE precios SET precio = ? WHERE tipo = 'NORMAL'`,
    [normal],
    (err1) => {
      if (err1) {
        console.log(err1);
        return res.json({ ok: false });
      }

      db.query(
        `UPDATE precios SET precio = ? WHERE tipo = 'INTENSIVO'`,
        [intensivo],
        (err2) => {
          if (err2) {
            console.log(err2);
            return res.json({ ok: false });
          }

          res.json({ ok: true });
        }
      );
    }
  );
});
app.get("/admin/grafica-ingresos", (req, res) => {
  db.query(
    `SELECT DATE(fecha) AS dia, SUM(precio) AS total
     FROM lavados
     GROUP BY DATE(fecha)
     ORDER BY DATE(fecha) ASC`,
    (err, result) => {
      if (err) {
        console.log(err);
        return res.json({ labels: [], valores: [] });
      }

      const labels = result.map(r => r.dia);
      const valores = result.map(r => Number(r.total));

      res.json({ labels, valores });
    }
  );
});
app.get("/admin/resumen-financiero", (req, res) => {
  db.query(
    `SELECT 
      SUM(CASE WHEN UPPER(tipo) = 'NORMAL' OR tipo = 'Automatico' THEN 1 ELSE 0 END) AS normales,
      SUM(CASE WHEN UPPER(tipo) = 'INTENSIVO' THEN 1 ELSE 0 END) AS intensivos,
      SUM(CASE WHEN UPPER(tipo) = 'NORMAL' OR tipo = 'Automatico' THEN precio ELSE 0 END) AS ingresoNormal,
      SUM(CASE WHEN UPPER(tipo) = 'INTENSIVO' THEN precio ELSE 0 END) AS ingresoIntensivo
     FROM lavados`,
    (err, result) => {
      if (err) {
        console.log(err);
        return res.json({
          normales: 0,
          intensivos: 0,
          ingresoNormal: 0,
          ingresoIntensivo: 0
        });
      }

      res.json(result[0] || {
        normales: 0,
        intensivos: 0,
        ingresoNormal: 0,
        ingresoIntensivo: 0
      });
    }
  );
});
app.get("/admin/exportar-excel", (req, res) => {
  db.query(
    `SELECT clientes.nombre, tarjetas.uid, lavados.tipo, lavados.precio, lavados.fecha
     FROM lavados
     JOIN tarjetas ON lavados.tarjeta_id = tarjetas.id
     JOIN clientes ON tarjetas.cliente_id = clientes.id
     ORDER BY lavados.fecha DESC`,
    (err, result) => {
      if (err) {
        console.log(err);
        return res.status(500).send("Error al exportar");
      }

      let csv = "Cliente,UID,Tipo,Precio,Fecha\n";

      result.forEach(row => {
        csv += `"${row.nombre}","${row.uid}","${row.tipo}","${row.precio}","${row.fecha}"\n`;
      });

      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=reporte_carwash.csv");
      res.send(csv);
    }
  );
});
app.listen(3000, () => {
  console.log("Servidor corriendo en puerto 3000");
});