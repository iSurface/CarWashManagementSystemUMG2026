-- ==========================================
-- CREAR BASE DE DATOS
-- ==========================================

CREATE DATABASE carwash;

USE carwash;


-- ==========================================
-- TABLA DE CLIENTES
-- ==========================================

CREATE TABLE clientes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    fecha_registro DATETIME DEFAULT CURRENT_TIMESTAMP
);


-- ==========================================
-- TABLA DE TARJETAS RFID
-- ==========================================

CREATE TABLE tarjetas (
    id INT AUTO_INCREMENT PRIMARY KEY,
    uid VARCHAR(50) UNIQUE NOT NULL,
    saldo DECIMAL(10,2) DEFAULT 0,
    cliente_id INT,
    fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (cliente_id) 
    REFERENCES clientes(id)
    ON DELETE SET NULL
);


-- ==========================================
-- TABLA DE LAVADOS REALIZADOS
-- ==========================================

CREATE TABLE lavados (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tarjeta_id INT,
    tipo VARCHAR(20),
    precio DECIMAL(10,2),
    fecha DATETIME DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (tarjeta_id)
    REFERENCES tarjetas(id)
);


-- ==========================================
-- PRECIOS DEL CAR WASH
-- ==========================================

CREATE TABLE precios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    tipo VARCHAR(20),
    precio DECIMAL(10,2)
);


-- PRECIOS INICIALES

INSERT INTO precios (tipo,precio) VALUES
('normal',25),
('intenso',40);