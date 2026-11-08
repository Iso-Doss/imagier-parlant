-- Base séparée pour les tests automatisés
CREATE DATABASE IF NOT EXISTS imagier_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
GRANT ALL PRIVILEGES ON imagier_test.* TO 'imagier'@'%';
