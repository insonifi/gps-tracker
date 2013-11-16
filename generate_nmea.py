#! /bin/env python
import socket
import sys
import time
from random import random

def checksum(line):
    """
    Returns the checksum as a one byte integer value.
    In this case the checksum is the XOR of everything after '$' and before '*'.
    """
    s = 0
    for c in line:
        s ^= ord(c)
    return '%02x' % s

def newCoord(last, bound):
    while True:
        new = last + (random() - 0.5) / 3
        if bound[0] < new and new < bound[1]:
            return new

def generateNmea(in_x, in_y):
    """
    (None) -> str
    Return valid GPRMC message for Latvia region
    """
    hr = '%02d' % time.gmtime().tm_hour
    min = '%02d' % time.gmtime().tm_min
    sec = '%02d' % time.gmtime().tm_sec
#     Generate coordinates somewhere in Latvian region.
    x = '%08.3f' % in_x
    y = '%08.3f' % in_y
    kph = '%05.1f' % (random() * 100)
    dd = '%02d' % time.gmtime().tm_mday
    mm = '%02d' % time.gmtime().tm_mon
    yy = str(time.gmtime().tm_year)[2:]
    nmea = 'GPRMC,{0}{1}{2},A,{3},N,{4},E,{5},090,{6}{7}{8},155'.format(hr, min, sec, x, y, kph, dd, mm, yy)
    return '$' + nmea + '*' + checksum(nmea)
    

ID = '37127099910'
HOST = '127.0.0.1'
PORT = 920
if len(sys.argv) > 1:
    ID = sys.argv[1]
if len(sys.argv) == 3:
    HOST, PORT = sys.argv[2].split(':')
s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
s.connect((HOST, int(PORT)))
s.send(bytearray('I' + ID, 'utf8'))
time.sleep(1)
xbound = (5650.000, 5660.000)
ybound = (2395.000, 2420.000)
x = 5655
y = 2405
print('send from ID {0} to {1}:{2}'.format(ID, HOST, PORT))
while True:
    x = newCoord(x, xbound)
    y = newCoord(y, ybound)
    nmea = generateNmea(x, y) 
    s.send(bytearray(nmea, 'utf8'))
    print(nmea)
    time.sleep(1)
