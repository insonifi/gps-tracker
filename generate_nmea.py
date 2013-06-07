#! /bin/env python
import socket
import sys
import time
from random import randint

def checksum(line):
    """
    Returns the checksum as a one byte integer value.
    In this case the checksum is the XOR of everything after '$' and before '*'.
    """
    s = 0
    for c in line:
        s ^= ord(c)
    return '%02x' % s

def generateNmea():
    """
    (None) -> str
    Return valid GPRMC message for Latvia region
    """
    hr = '%02d' % time.gmtime().tm_hour
    min = '%02d' % time.gmtime().tm_min
    sec = '%02d' % time.gmtime().tm_sec
    x = '%03d' % randint(0, 999)
    y = '%03d' % randint(0, 999)
    kph = '%03d' % randint(0, 100)
    dd = '%02d' % time.gmtime().tm_mday
    mm = '%02d' % time.gmtime().tm_mon
    yy = str(time.gmtime().tm_year)[2:]
    nmea = 'GPRMC,{0}{1}{2},A,5653.{3},N,02405.{4},E,{5},090,{6}{7}{8},155'.format(hr, min, sec, x, y, kph, dd, mm, yy)
    return '$' + nmea + '*' + checksum(nmea)
    

ID = 'I37127099910'
HOST = '127.0.0.1'
PORT = 920
if len(sys.argv) == 3:
    HOST = sys.argv[1]
    ID = sys.argv[2]
s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
s.connect((HOST, PORT))
s.send(bytearray(ID + '\n', 'utf8'))
while True:
    s.send(bytearray(generateNmea() + '\n', 'utf8'))
    time.sleep(1.2)
